import { DirectusAdminClient } from './directusAdmin';

// Helper to calculate, reconcile orders, and strictly persist current_balance in Directus financial_accounts table
export async function syncAndPersistFinancialAccountBalances(orgIdNum: number) {
  try {
    const [accItems, treasuryTxs, orders] = await Promise.all([
      DirectusAdminClient.getItems('financial_accounts', {
        filter: { organization_id: { _eq: orgIdNum } },
        limit: -1,
      }).catch(() => []),
      DirectusAdminClient.getItems('treasury_transactions', {
        filter: { organization_id: { _eq: orgIdNum } },
        limit: -1,
      }).catch(() => []),
      DirectusAdminClient.getItems('orders', {
        filter: { organization_id: { _eq: orgIdNum } },
        limit: -1,
      }).catch(() => []),
    ]);

    let accounts = accItems || [];
    if (accounts.length === 0) {
      // Auto-seed default accounts for the organization if none exist
      const now = new Date().toISOString();
      const defaultAccounts = [
        {
          organization_id: orgIdNum,
          name: 'صندوق نقدی مرکزی',
          type: 'cashbox',
          initial_balance: 0,
          current_balance: 0,
          is_default: true,
          date_created: now,
        },
        {
          organization_id: orgIdNum,
          name: 'حساب جاری بانک ملت',
          type: 'bank',
          bank_name: 'بانک ملت',
          initial_balance: 0,
          current_balance: 0,
          is_default: false,
          date_created: now,
        },
        {
          organization_id: orgIdNum,
          name: 'کارتخوان فروشگاه (POS)',
          type: 'pos',
          initial_balance: 0,
          current_balance: 0,
          is_default: false,
          date_created: now,
        },
      ];
      for (const defAcc of defaultAccounts) {
        try {
          const createdAcc = await DirectusAdminClient.createItem('financial_accounts', defAcc);
          accounts.push(createdAcc);
        } catch (createErr: any) {
          console.warn('[API Proxy] Error creating default account:', createErr?.message);
        }
      }
    }

    const defaultCashbox =
      accounts.find((a: any) => a.type === 'cashbox' && a.is_default) ||
      accounts.find((a: any) => a.type === 'cashbox') ||
      accounts[0];
    const defaultPos =
      accounts.find((a: any) => a.type === 'pos' && a.is_default) ||
      accounts.find((a: any) => a.type === 'pos') ||
      accounts.find((a: any) => a.type === 'bank') ||
      defaultCashbox;
    const defaultBank =
      accounts.find((a: any) => a.type === 'bank' && a.is_default) ||
      accounts.find((a: any) => a.type === 'bank') ||
      defaultCashbox;

    // Check for completed or paid orders that don't have treasury transactions yet
    const existingTracking = new Set(
      (treasuryTxs || [])
        .map((t: any) => String(t.tracking_code || '').trim())
        .filter(Boolean)
    );
    const allTxs = [...(treasuryTxs || [])];

    for (const ord of orders || []) {
      if (ord.status === 'cancelled') continue;
      const isPaid = ord.payment_status === 'paid' || ord.status === 'completed';
      const ordAmt =
        Number(
          ord.total ?? ord.grand_total ?? ord.final_amount ?? ord.total_amount ?? ord.subtotal
        ) || 0;
      const ordNum = String(ord.order_number || ord.id);
      const trackingCode = `ORD-${ordNum}`;

      if (isPaid && ordAmt > 0 && !existingTracking.has(trackingCode)) {
        let destAcc = defaultCashbox;
        const pMethod = ord.payment_method || ord.payment_type;
        const customAccId = ord.financial_account_id;

        if (customAccId) {
          const found = accounts.find(
            (a: any) =>
              Number(a.id) ===
              Number(typeof customAccId === 'object' ? customAccId.id : customAccId)
          );
          if (found) destAcc = found;
        } else if (ord.warehouse_id) {
          const rawWhId =
            typeof ord.warehouse_id === 'object' ? ord.warehouse_id.id : ord.warehouse_id;
          const whAcc = accounts.find((a: any) => {
            const aWh = typeof a.warehouse_id === 'object' ? a.warehouse_id.id : a.warehouse_id;
            if (Number(aWh) === Number(rawWhId)) {
              if (pMethod === 'pos') return a.type === 'pos' || a.type === 'bank';
              return a.type === 'cashbox' || a.type === 'petty_cash';
            }
            return false;
          });
          if (whAcc) destAcc = whAcc;
          else if (pMethod === 'pos') destAcc = defaultPos;
          else if (pMethod === 'card_to_card' || pMethod === 'bank') destAcc = defaultBank;
        } else if (pMethod === 'pos') {
          destAcc = defaultPos;
        } else if (pMethod === 'card_to_card' || pMethod === 'bank') {
          destAcc = defaultBank;
        }

        if (destAcc) {
          try {
            const newTx = await DirectusAdminClient.createItem('treasury_transactions', {
              organization_id: orgIdNum,
              destination_account_id: Number(destAcc.id),
              type: 'deposit',
              amount: ordAmt,
              tracking_code: trackingCode,
              description: `دریافت وجه فاکتور فروش #${ordNum} (همگام‌سازی خودکار)`,
              transaction_date: ord.order_date || ord.date_created || new Date().toISOString(),
            });
            allTxs.push(newTx);
            existingTracking.add(trackingCode);
          } catch (txErr: any) {
            console.warn(
              `[API Proxy] Error creating treasury tx for order #${ord.id}:`,
              txErr?.message
            );
          }
        }
      }
    }

    // Recalculate each account's exact balance
    const mapped = await Promise.all(
      accounts.map(async (acc: any) => {
        const accId = Number(acc.id);
        let balance = Number(acc.initial_balance) || 0;

        allTxs.forEach((tx: any) => {
          const amt = Number(tx.amount) || 0;
          const srcId =
            typeof tx.source_account_id === 'object'
              ? tx.source_account_id?.id
              : tx.source_account_id;
          const dstId =
            typeof tx.destination_account_id === 'object'
              ? tx.destination_account_id?.id
              : tx.destination_account_id;

          if (tx.type === 'deposit' && Number(dstId) === accId) {
            balance += amt;
          } else if (tx.type === 'withdrawal' && Number(srcId) === accId) {
            balance -= amt;
          } else if (tx.type === 'transfer') {
            if (Number(dstId) === accId) balance += amt;
            if (Number(srcId) === accId) balance -= amt;
          }
        });

        // CRITICAL: PERSIST current_balance DIRECTLY INTO DIRECTUS DATABASE!
        if (Number(acc.current_balance) !== balance) {
          await DirectusAdminClient.updateItem('financial_accounts', acc.id, {
            current_balance: balance,
          }).catch((updateErr: any) =>
            console.warn(
              `[API Proxy] Failed to persist current_balance for account #${acc.id}:`,
              updateErr?.message
            )
          );
        }

        return {
          ...acc,
          current_balance: balance,
        };
      })
    );

    return mapped;
  } catch (error: any) {
    console.error('[API Proxy] Error in syncAndPersistFinancialAccountBalances:', error.message);
    return [];
  }
}
