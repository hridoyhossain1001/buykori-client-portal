import type { UserProfile } from '../types';

export const aiAdsUiEnabled = (profile: Pick<UserProfile, 'aiAdsEnabled'> | null | undefined) =>
  profile?.aiAdsEnabled === true;

export const clientPageAllowed = (
  pageId: string,
  profile: Pick<UserProfile, 'aiAdsEnabled'> | null | undefined,
) => pageId !== 'ai-ads' || aiAdsUiEnabled(profile);
