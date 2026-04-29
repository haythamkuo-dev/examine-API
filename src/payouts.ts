export type PayoutChannel = 'co_bank' | 'co_wallet' | 'imps' | 'bd_wallet';

type Amount = {
  amount: string;
  currency_code: string;
};

type PayoutBeneficiary = {
  name: string;
  first_name?: string;
  last_name?: string;
  identification_type?: string;
  id_number?: string;
  account_number: string;
  bank_account_type?: string;
  bank_code?: string;
  bank_name?: string;
  email?: string;
};

type PayoutInfo = {
  account_type?: string;
  narration?: string;
  client_ip?: string;
  beneficiary: PayoutBeneficiary;
};

export type PayoutPayload = {
  product_no: string;
  merchant_reference: string;
  amount: Amount;
  payout_info: PayoutInfo;
};

type PayoutTemplate = {
  productNo: string;
  amount: Amount;
  payoutInfo: PayoutInfo;
};

const PAYOUT_TEMPLATES: Record<PayoutChannel, PayoutTemplate> = {
  co_bank: {
    productNo: Bun.env.PAYOUT_CO_BANK || 'PAY-FUTUREPAY_COLLECT-BANKTRANSFERCO-COP',
    amount: { amount: '10.00', currency_code: 'COP' },
    payoutInfo: {
      account_type: 'individual',
      narration: 'E2E payout order',
      client_ip: '127.0.0.1',
      beneficiary: {
        name: 'E2E Payout Beneficiary',
        first_name: 'E2E',
        last_name: 'Beneficiary',
        identification_type: 'CC',
        id_number: '1020806281',
        account_number: '03179596864',
        bank_account_type: 'cc',
        bank_code: '1007',
        bank_name: 'BANCOLOMBIA',
        email: 'e2e@example.com',
      },
    },
  },
  co_wallet: {
    productNo: Bun.env.PAYOUT_CO_WALLET || 'PAY-FUTUREPAY_COLLECT-MOBILEMONEY-COP',
    amount: { amount: '10.00', currency_code: 'COP' },
    payoutInfo: {
      account_type: 'individual',
      narration: 'E2E payout order',
      client_ip: '127.0.0.1',
      beneficiary: {
        name: 'E2E Payout Beneficiary',
        identification_type: 'CC',
        id_number: '1020806281',
        account_number: '03179596864',
        bank_account_type: 'dp',
        bank_code: '1007',
        bank_name: 'NEQUI',
      },
    },
  },
  imps: {
    productNo: Bun.env.PAYOUT_IMPS || 'PAY-EC-IMPS-INR',
    amount: { amount: '100.00', currency_code: 'INR' },
    payoutInfo: {
      beneficiary: {
        name: 'Rahul Kumar',
        account_number: '1234567890',
        bank_name: 'BENEFICIARY BANK',
        bank_code: 'BANK0001234',
      },
    },
  },
  bd_wallet: {
    productNo: Bun.env.PAYOUT_BD_WALLET || 'PAY-FUTUREPAY_COLLECT-BD-MSOBILE-WALLET-COP',
    amount: { amount: '100.00', currency_code: 'BDT' },
    payoutInfo: {
      narration: 'payout remark',
      beneficiary: {
        name: 'Md. Rahim',
        account_number: '8801712345678',
      },
    },
  },
};

export const createPayoutPayload = (
  channel: PayoutChannel,
  makeId: (prefix: string) => string,
): PayoutPayload => {
  const template = PAYOUT_TEMPLATES[channel];

  return {
    product_no: template.productNo,
    merchant_reference: makeId('TEST_ORDER_'),
    amount: {
      ...template.amount,
    },
    payout_info: {
      ...template.payoutInfo,
      beneficiary: {
        ...template.payoutInfo.beneficiary,
      },
    },
  };
};
