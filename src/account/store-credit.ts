import { postRsiJson } from '@/shared/rsi-api';

/*
 * The account's store credit, as RSI's account menu (the profile picture at the top right) shows
 * it: read from the same GraphQL query, the account's "credit" ledger. Works with the session of
 * the RSI page.
 */

export interface StoreCredit {
  /** In the ledger's currency, e.g. 233.96. */
  amount: number;
  /** ISO code of the currency, e.g. "USD". */
  currency: string;
}

const QUERY =
  'query StoreCredit { customer { ledger(ledgerCode: "credit") { amount { value currency { code } } } } }';

export interface StoreCreditAnswer {
  data?: {
    customer?: {
      ledger?: {
        amount?: { value?: number | null; currency?: { code?: string | null } | null } | null;
      } | null;
    } | null;
  };
  errors?: { message: string }[];
}

export async function fetchStoreCredit(): Promise<StoreCredit> {
  const [answer] = await postRsiJson<[StoreCreditAnswer | undefined]>('/graphql', [
    { operationName: 'StoreCredit', query: QUERY, variables: {} },
  ]);
  return parseStoreCredit(answer);
}

/** The store credit of an answer (RSI's amount is in cents). */
export function parseStoreCredit(answer: StoreCreditAnswer | undefined): StoreCredit {
  if (answer?.errors?.length) {
    throw new Error(`Loading the store credit failed: ${answer.errors[0]!.message}`);
  }
  const amount = answer?.data?.customer?.ledger?.amount;
  if (typeof amount?.value !== 'number') {
    throw new Error('Loading the store credit failed: no amount in the answer');
  }
  return { amount: amount.value / 100, currency: amount.currency?.code || 'USD' };
}
