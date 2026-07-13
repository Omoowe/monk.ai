import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Set these in your RevenueCat dashboard → Apps
// iOS: RevenueCat Dashboard → Project → Apps → Apple App Store → Public SDK Key
// Android: RevenueCat Dashboard → Project → Apps → Google Play → Public SDK Key
const RC_IOS_KEY     = process.env.EXPO_PUBLIC_RC_IOS_KEY     ?? '';
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';

export const ENTITLEMENT_PRO = 'pro';
export const TRIAL_DAYS = 3;

export function configureRevenueCat(): void {
  if (Platform.OS === 'web') return; // RC has no web SDK
  const apiKey = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
  if (!apiKey) return; // no-op until keys are set
  Purchases.setLogLevel(LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey });
}

export async function identifyUser(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
  } catch {
    // Non-fatal — app works without RC identity
  }
}

// MOCK MODE: only active in development builds AND when no RC keys are set
const MOCK_PURCHASES = __DEV__ && !process.env.EXPO_PUBLIC_RC_IOS_KEY && !process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

export async function getMonthlyPackage(): Promise<PurchasesPackage | null> {
  if (MOCK_PURCHASES) return { identifier: '$rc_monthly', product: { identifier: '$rc_monthly', priceString: '$9.00', price: 9.0 } } as any;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.monthly ?? offerings.current?.availablePackages[0] ?? null;
  } catch {
    return null;
  }
}

export async function getBothPackages(): Promise<{ monthly: PurchasesPackage | null; annual: PurchasesPackage | null }> {
  if (MOCK_PURCHASES) {
    return {
      monthly: { identifier: '$rc_monthly', product: { identifier: '$rc_monthly', priceString: '$9.00', price: 9.0 } } as any,
      annual:  { identifier: '$rc_annual',  product: { identifier: '$rc_annual',  priceString: '$79.00', price: 79.0 } } as any,
    };
  }
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    return {
      monthly: current?.monthly ?? null,
      annual:  current?.annual  ?? null,
    };
  } catch {
    return { monthly: null, annual: null };
  }
}

export async function purchasePro(pkg: PurchasesPackage): Promise<boolean> {
  if (MOCK_PURCHASES) {
    await syncProStatus(true);
    return true;
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return isPro(customerInfo);
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (MOCK_PURCHASES) {
    await syncProStatus(true);
    return true;
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    const pro = isPro(customerInfo);
    if (pro) await syncProStatus(true);
    return pro;
  } catch {
    return false;
  }
}

export function isPro(customerInfo: CustomerInfo): boolean {
  return !!customerInfo.entitlements.active[ENTITLEMENT_PRO];
}

export async function checkTrialEligibility(productIdentifier: string): Promise<boolean> {
  if (MOCK_PURCHASES) return true;
  try {
    const result = await Purchases.checkTrialOrIntroductoryPriceEligibility([productIdentifier]);
    const status = result[productIdentifier]?.status;
    return status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
  } catch {
    return false;
  }
}

export async function syncProStatus(proStatus: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('users').update({ is_pro: proStatus }).eq('id', user.id);
}
