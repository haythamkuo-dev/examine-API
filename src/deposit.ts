export type DepositChannel =
  | 'southafrica_cards'
  | 'linepay'
  | 'linepay_invoice'
  | 'inr_upi'
  | 'bdt_worldpay'
  | 'co_bank_transfer'
  | 'co_cash'
  | 'co_nequi'
  | 'co_pse'
  | 'th_rabbit_linepay'
  | 'my_tng';

type Amount = {
  amount: string;
  currency_code: string;
};

type DepositTemplate = {
  product_no: string;
  amount: Amount;
  return_url?: string;
  payment_order?: Record<string, unknown>;
  issue_invoice?: boolean;
  invoice?: Record<string, unknown>;
};

export type DepositPayload = {
  product_no: string;
  merchant_ref: string;
  amount: Amount;
  return_url?: string;
  payment_order?: Record<string, unknown>;
  issue_invoice?: boolean;
  invoice?: Record<string, unknown>;
};

const DEPOSIT_TEMPLATES: Record<DepositChannel, DepositTemplate> = {
  southafrica_cards: {
    product_no: Bun.env.DEPOSIT_SOUTHAFICA_CARDS || 'TEST_PRODUCT_123',
    amount: { amount: '99.00', currency_code: 'USD' },
    return_url: Bun.env.CALLBACK_URL_DEPOSIT,
  },
  linepay: {
    product_no: 'DEP-LINEPAY_ONLINE-ONLINE-TWD',
    amount: { amount: '100', currency_code: 'TWD' },
    return_url: Bun.env.CALLBACK_URL_DEPOSIT,
    payment_order: {
      linepay_online: {
        confirm_url:
          'https://merchant.example.com/linepay/confirm?merchant_ref=M-ORDER-LINEPAY-000001',
        cancel_url:
          'https://merchant.example.com/linepay/cancel?merchant_ref=M-ORDER-LINEPAY-000001',
        packages: [
          {
            id: 'pkg-1',
            name: 'Default Package',
            amount: 100,
            products: [{ id: 'SKU-001', name: 'Sample Item', quantity: 1, price: 100 }],
          },
        ],
      },
    },
  },
  linepay_invoice: {
    product_no: 'DEP-LINEPAY_ONLINE-ONLINE-TWD',
    amount: { amount: '120', currency_code: 'TWD' },
    return_url: Bun.env.CALLBACK_URL_DEPOSIT,
    payment_order: {
      linepay_online: {
        confirm_url:
          'https://merchant.example.com/linepay/confirm?merchant_ref=M-ORDER-LINEPAY-INV-000001',
        cancel_url:
          'https://merchant.example.com/linepay/cancel?merchant_ref=M-ORDER-LINEPAY-INV-000001',
        packages: [
          {
            id: 'pkg-1',
            name: 'Default Package',
            amount: 120,
            products: [{ id: 'SKU-001', name: 'Sample Item', quantity: 1, price: 120 }],
          },
        ],
      },
    },
    issue_invoice: true,
    invoice: {
      relate_number: 'INV-20250101-000123',
      print: '0',
      donation: '0',
      tax_type: '1',
      sales_amount: 120,
      inv_type: '07',
      vat: '1',
      customer_email: 'buyer@example.com',
      items: [
        {
          item_seq: 1,
          item_name: 'Sample Item',
          item_count: 1,
          item_word: '件',
          item_price: 120,
          item_amount: 120,
        },
      ],
    },
  },
  inr_upi: {
    product_no: 'DEP-EC-UPI-INR',
    amount: { amount: '100.00', currency_code: 'INR' },
    return_url: Bun.env.CALLBACK_URL_DEPOSIT,
  },
  bdt_worldpay: {
    product_no: 'DEP-WORLDPAY-bkash-BDT',
    amount: { amount: '100.00', currency_code: 'BDT' },
    return_url: Bun.env.CALLBACK_URL_DEPOSIT,
    payment_order: {
      worldpay: {
        payer_key: 'PAYER-001',
        payer_name: 'Amy',
      },
    },
  },
  co_bank_transfer: {
    product_no: 'DEP-SINGLEPAYMENT-BANKTRANSFERCO-COP',
    amount: { amount: '1000', currency_code: 'COP' },
    return_url: Bun.env.CALLBACK_URL_DEPOSIT,
    payment_order: {
      country_code: 'CO',
      product_detail: 'Single Payment Bank Transfer order for %s',
      singlepayment_banktransferco: {
        shopper_email: 'shopper@example.com',
        bank_name: '1234',
        tax_type: 'COL_CC',
        personal_tax_id: '36570630563',
        origin: 'merchant.example.com',
        shopper_reference: 'CUSTOMER_001',
      },
    },
  },
  co_cash: {
    product_no: 'DEP-SINGLEPAYMENT-CASHCO-COP',
    amount: { amount: '1000', currency_code: 'COP' },
    return_url: Bun.env.CALLBACK_URL_DEPOSIT,
    payment_order: {
      country_code: 'CO',
      product_detail: 'Single Payment CASH order for %s',
      singlepayment_cashco: {
        shopper_email: 'shopper@example.com',
        bank_name: '8323',
        origin: 'merchant.example.com',
        shopper_reference: 'CUSTOMER_001',
      },
    },
  },
  co_nequi: {
    product_no: 'DEP-SINGLEPAYMENT-NEQUICO-COP',
    amount: { amount: '1000', currency_code: 'COP' },
    return_url: Bun.env.CALLBACK_URL_DEPOSIT,
    payment_order: {
      country_code: 'CO',
      product_detail: 'Single Payment NEQUI order for %s',
      singlepayment_nequico: {
        shopper_email: 'shopper@example.com',
        holder_name: 'JW L',
        telephone_number: '575555555555',
        tax_type: 'CC',
        personal_tax_id: '36570630563',
        origin: 'merchant.example.com',
        shopper_reference: 'CUSTOMER_001',
      },
    },
  },
  co_pse: {
    product_no: 'DEP-SINGLEPAYMENT-PSECO-COP',
    amount: { amount: '1000', currency_code: 'COP' },
    return_url: Bun.env.CALLBACK_URL_DEPOSIT,
    payment_order: {
      country_code: 'CO',
      product_detail: 'Single Payment PSE order for %s',
      singlepayment_pseco: {
        shopper_email: 'shopper@example.com',
        holder_name: 'JW L',
        telephone_number: '575555555555',
        bank_name: '1001',
        tax_type: 'PPT',
        personal_tax_id: '36570630563',
        origin: 'merchant.example.com',
        shopper_reference: 'CUSTOMER_001',
      },
    },
  },
  th_rabbit_linepay: {
    product_no: 'DEP-SINGLEPAYMENT-RABBITLINEPAY-THB',
    amount: { amount: '100.00', currency_code: 'THB' },
    return_url: Bun.env.CALLBACK_URL_DEPOSIT,
    payment_order: {
      country_code: 'TH',
      product_detail: 'Single Payment Rabbit LINE Pay order for %s',
      singlepayment_rabbitlinepay: {
        origin: 'merchant.example.com',
        shopper_reference: 'CUSTOMER_001',
        shopper_email: 'shopper@example.com',
        holder_name: 'Rabbit User',
        browser_info: {
          os_type: 'ANDROID',
          terminal_type: 'APP',
        },
      },
    },
  },
  my_tng: {
    product_no: 'DEP-SINGLEPAYMENT-TNG-MYR',
    amount: { amount: '45.00', currency_code: 'MYR' },
    return_url: Bun.env.CALLBACK_URL_DEPOSIT,
    payment_order: {
      country_code: 'MY',
      product_detail: 'Single Payment TNG order for %s',
      singlepayment_tng: {
        origin: 'merchant.example.com',
        shopper_reference: 'CUSTOMER_001',
        shopper_email: 'shopper@example.com',
        holder_name: 'Test User',
        browser_info: {
          os_type: 'IOS',
          terminal_type: 'APP',
        },
      },
    },
  },
};

export const createDepositPayload = (
  channel: DepositChannel,
  makeId: (prefix: string) => string,
): DepositPayload => {
  const template = DEPOSIT_TEMPLATES[channel];

  return {
    ...template,
    merchant_ref: makeId('TEST_ORDER_'),
    amount: {
      ...template.amount,
    },
    payment_order: template.payment_order
      ? {
          ...template.payment_order,
        }
      : undefined,
    invoice: template.invoice
      ? {
          ...template.invoice,
        }
      : undefined,
  };
};
