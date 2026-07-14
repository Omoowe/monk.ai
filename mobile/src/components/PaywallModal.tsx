import React, { useState, useEffect } from 'react';
import { fscale, scale } from '../utils/scale';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { type PurchasesPackage } from 'react-native-purchases';
import { getBothPackages, purchasePro, restorePurchases, syncProStatus, checkTrialEligibility, TRIAL_DAYS } from '../services/purchases';

const PRIVACY_POLICY_URL = 'https://monkai.app/privacy';
const TERMS_URL = 'https://monkai.app/terms';

interface Props {
  visible: boolean;
  onClose: () => void;
  onUpgraded?: () => void;
  trigger?: 'messages' | 'personality' | 'goals' | 'habits' | 'review' | 'monkmode';
}

const TRIGGER_COPY: Record<string, { title: string; sub: string }> = {
  messages:    { title: "You've hit your daily limit.", sub: 'Free users get 10 AI messages per day.' },
  personality: { title: 'Coach locked.', sub: 'Free users get the Stoic Mentor. Pro unlocks all 6.' },
  goals:       { title: 'Goal limit reached.', sub: 'Free users can track 2 goals. Go Pro for unlimited.' },
  habits:      { title: 'Habit limit reached.', sub: 'Free users can track 3 habits. Go Pro for unlimited.' },
  review:      { title: 'Weekly review is Pro.', sub: 'Your AI coach writes a full weekly analysis. Pro only.' },
  monkmode:    { title: 'Monk Mode is Pro.', sub: 'No Excuses and Strict Goals require a Pro subscription.' },
};

const PRO_PERKS = [
  'All 6 coach personalities',
  'Unlimited AI messages',
  'Unlimited habits + goals',
  'Weekly AI review',
  'Full Monk Mode access',
];

export default function PaywallModal({ visible, onClose, onUpgraded, trigger = 'messages' }: Props) {
  const { title, sub } = TRIGGER_COPY[trigger] ?? TRIGGER_COPY.messages;
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | null>(null);
  const [annualPkg,  setAnnualPkg]  = useState<PurchasesPackage | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);
  const [loadingPkg, setLoadingPkg] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [trialEligible, setTrialEligible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoadingPkg(true);
    setTrialEligible(false);
    getBothPackages()
      .then(async ({ monthly, annual }) => {
        setMonthlyPkg(monthly);
        setAnnualPkg(annual);
        // Default to annual if available, else monthly
        setSelectedPlan(annual ? 'annual' : 'monthly');
        const activePkg = monthly ?? annual;
        if (activePkg) {
          const eligible = await checkTrialEligibility(activePkg.product.identifier ?? '$rc_monthly');
          setTrialEligible(eligible);
        }
      })
      .finally(() => setLoadingPkg(false));
  }, [visible]);

  const pkg = selectedPlan === 'annual' ? (annualPkg ?? monthlyPkg) : (monthlyPkg ?? annualPkg);
  const monthlyPrice = monthlyPkg?.product.price ?? 9.0;
  const annualPrice  = annualPkg?.product.price  ?? 79.0;
  const savingsPct   = monthlyPrice > 0 ? Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100) : 26;
  const annualPerMonth = annualPrice > 0 ? (annualPrice / 12).toFixed(2) : '6.58';
  const priceLabel   = pkg?.product.priceString ?? (selectedPlan === 'annual' ? '$79.00' : '$9.00');

  const handleUpgrade = async () => {
    if (!pkg) {
      Alert.alert('Store unavailable', 'Could not load products. Check your connection and try again.');
      return;
    }
    setLoading(true);
    try {
      const success = await purchasePro(pkg);
      if (success) {
        await syncProStatus(true);
        onUpgraded?.();
        onClose();
      }
    } catch (e: any) {
      Alert.alert('Purchase failed', e?.message ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.pillBar} />

          <Text style={s.title}>{title}</Text>
          <Text style={s.sub}>{sub}</Text>

          <View style={s.divider} />

          {/* Plan toggle */}
          {!loadingPkg && (
            <View style={s.planToggle}>
              <TouchableOpacity
                style={[s.planBtn, selectedPlan === 'monthly' && s.planBtnActive]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.8}
              >
                <Text style={[s.planBtnLabel, selectedPlan === 'monthly' && s.planBtnLabelActive]}>MONTHLY</Text>
                <Text style={[s.planBtnPrice, selectedPlan === 'monthly' && s.planBtnPriceActive]}>
                  {monthlyPkg?.product.priceString ?? '$9.00'}/mo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.planBtn, selectedPlan === 'annual' && s.planBtnActive]}
                onPress={() => setSelectedPlan('annual')}
                activeOpacity={0.8}
              >
                <View style={s.planBtnAnnualRow}>
                  <Text style={[s.planBtnLabel, selectedPlan === 'annual' && s.planBtnLabelActive]}>ANNUAL</Text>
                  <View style={s.savingsBadge}>
                    <Text style={s.savingsBadgeText}>SAVE {savingsPct}%</Text>
                  </View>
                </View>
                <Text style={[s.planBtnPrice, selectedPlan === 'annual' && s.planBtnPriceActive]}>
                  ${annualPerMonth}/mo
                </Text>
                <Text style={[s.planBtnSub, selectedPlan === 'annual' && { color: '#6a9030' }]}>
                  {annualPkg?.product.priceString ?? '$79.00'} billed yearly
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.perksLabel}>
            {loadingPkg
              ? 'MONK PRO'
              : trialEligible && selectedPlan === 'monthly'
              ? `MONK PRO — ${TRIAL_DAYS}-DAY FREE TRIAL`
              : 'MONK PRO'}
          </Text>
          {PRO_PERKS.map((perk) => (
            <View key={perk} style={s.perkRow}>
              <View style={s.perkDot} />
              <Text style={s.perkText}>{perk}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={[s.upgradBtn, loading && { opacity: 0.7 }]}
            onPress={handleUpgrade}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#0a0a0a" />
              : <Text style={s.upgradBtnText}>
                  {trialEligible && selectedPlan === 'monthly'
                    ? `Start ${TRIAL_DAYS}-Day Free Trial`
                    : selectedPlan === 'annual'
                    ? `Get Pro — ${annualPkg?.product.priceString ?? '$79.00'}/yr`
                    : 'Upgrade to Pro'}
                </Text>
            }
          </TouchableOpacity>
          {trialEligible && selectedPlan === 'monthly' && !loading && (
            <Text style={s.trialSub}>then {monthlyPkg?.product.priceString ?? '$9.00'}/month · cancel anytime</Text>
          )}
          {selectedPlan === 'annual' && !loading && (
            <Text style={s.trialSub}>${annualPerMonth}/month · billed as {annualPkg?.product.priceString ?? '$79.00'}/year</Text>
          )}

          <TouchableOpacity
            style={s.restoreBtn}
            onPress={async () => {
              setRestoring(true);
              try {
                const restored = await restorePurchases();
                if (restored) {
                  onUpgraded?.();
                  onClose();
                } else {
                  Alert.alert('Nothing to restore', 'No active Pro subscription found.');
                }
              } catch {
                Alert.alert('Error', 'Could not restore purchases. Try again.');
              } finally {
                setRestoring(false);
              }
            }}
            disabled={loading || restoring}
            activeOpacity={0.7}
          >
            {restoring
              ? <ActivityIndicator color="#666" size={14} />
              : <Text style={s.restoreText}>Restore Purchases</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.dismissBtn} onPress={onClose} activeOpacity={0.7} disabled={loading || restoring}>
            <Text style={s.dismissText}>Maybe later</Text>
          </TouchableOpacity>

          <Text style={s.legalText}>
            {trialEligible && selectedPlan === 'monthly'
              ? `${TRIAL_DAYS}-day free trial, then ${monthlyPkg?.product.priceString ?? '$9.00'}/month. `
              : ''}
            {selectedPlan === 'annual' ? 'Auto-renews annually.' : 'Auto-renews monthly.'}{' '}
            Cancel anytime in App Store settings.{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>Privacy</Text>
            {' · '}
            <Text style={s.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>Terms</Text>
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
    alignItems: 'center',
  },
  pillBar: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#333', marginBottom: 24,
  },
  title: {
    fontSize: fscale(22), fontWeight: '800', color: '#fff',
    fontFamily: 'Syne_800ExtraBold', textAlign: 'center',
    marginBottom: 6, letterSpacing: -0.5,
  },
  sub: { fontSize: fscale(14), color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: fscale(20) },
  divider: { width: '100%', height: 1, backgroundColor: '#1e1e1e', marginBottom: 20 },
  perksLabel: {
    fontSize: fscale(10), fontWeight: '700', color: '#b8f058',
    letterSpacing: 1.5, marginBottom: 14, alignSelf: 'flex-start',
    fontFamily: 'DMMono_400Regular',
  },
  perkRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, alignSelf: 'flex-start', marginBottom: 10,
  },
  perkDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#b8f058' },
  perkText: { fontSize: fscale(14), color: '#aaaaaa', fontWeight: '600' },
  upgradBtn: {
    width: '100%', backgroundColor: '#b8f058', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 24, marginBottom: 12,
    minHeight: 52, justifyContent: 'center',
  },
  upgradBtnText: {
    fontSize: fscale(15), fontWeight: '800', color: '#0a0a0a',
    fontFamily: 'Syne_800ExtraBold', letterSpacing: -0.3,
  },
  trialSub: {
    fontSize: fscale(12), color: '#888', textAlign: 'center',
    marginTop: -6, marginBottom: 6,
  },
  planToggle: {
    flexDirection: 'row', gap: 10, width: '100%', marginBottom: 20,
  },
  planBtn: {
    flex: 1, borderRadius: 12, padding: 14,
    backgroundColor: '#181818', borderWidth: 1.5, borderColor: '#2a2a2a',
    alignItems: 'center', gap: 3,
  },
  planBtnActive: {
    borderColor: '#b8f058', backgroundColor: '#0d1a07',
  },
  planBtnAnnualRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planBtnLabel: { fontSize: fscale(9), letterSpacing: 2, color: '#888', fontFamily: 'DMMono_400Regular', fontWeight: '700' },
  planBtnLabelActive: { color: '#b8f058' },
  planBtnPrice: { fontSize: fscale(18), fontWeight: '800', color: '#777', fontFamily: 'Syne_800ExtraBold' },
  planBtnPriceActive: { color: '#fff' },
  planBtnSub: { fontSize: fscale(10), color: '#777', fontFamily: 'DMMono_400Regular', textAlign: 'center' },
  savingsBadge: {
    backgroundColor: '#b8f058', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  savingsBadgeText: { fontSize: fscale(8), fontWeight: '800', color: '#0a0a0a', letterSpacing: 0.5 },
  restoreBtn: { paddingVertical: 10 },
  restoreText: { fontSize: fscale(13), color: '#666', fontWeight: '600' },
  dismissBtn: { paddingVertical: 6 },
  dismissText: { fontSize: fscale(13), color: '#333', fontWeight: '500' },
  legalText: {
    fontSize: fscale(10), color: '#333', textAlign: 'center',
    marginTop: 12, lineHeight: fscale(15),
  },
  legalLink: { color: '#888', textDecorationLine: 'underline' },
});
