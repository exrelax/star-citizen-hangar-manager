import { shallowRef } from 'vue';

/*
 * Opens the advice for CCUs that lose value (#252, CcuAdviceOverlay.vue) from anywhere: the
 * details of an affected CCU of My Hangar, and the sidebar's notification (#254). The manager
 * shows the dialog while a request is set.
 */

export interface CcuAdviceRequest {
  /** The CCU it was opened from: its group comes first. */
  pledgeId?: number;
}

export const ccuAdviceRequest = shallowRef<CcuAdviceRequest>();

export const openCcuAdvice = (pledgeId?: number) =>
  (ccuAdviceRequest.value = pledgeId === undefined ? {} : { pledgeId });

export const closeCcuAdvice = () => (ccuAdviceRequest.value = undefined);
