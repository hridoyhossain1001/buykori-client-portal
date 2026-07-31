export interface CampaignCustomParam {
  k: string;
  v: string;
}

export interface CampaignPayloadInput {
  builderEventName: string;
  builderValue: string;
  builderCurrency: string;
  builderEmail: string;
  builderPhone: string;
  builderIp: string;
  builderUa: string;
  customParams: CampaignCustomParam[];
}

/**
 * Builds the JSON shown in the Event Data Preview panel.
 *
 * Moved verbatim out of CampaignBuilderView. Note that event_time is read at
 * call time, so the preview and a copy taken later can differ by a second -
 * that was true before this split too.
 */
export function buildCampaignPayloadJson({
  builderEventName,
  builderValue,
  builderCurrency,
  builderEmail,
  builderPhone,
  builderIp,
  builderUa,
  customParams,
}: CampaignPayloadInput): string {
  const customObj: Record<string, string> = {};
  (customParams || []).forEach(p => {
    if (p.k.trim()) customObj[p.k.trim()] = p.v;
  });

  return JSON.stringify({
    event_source: "server",
    event_name: builderEventName,
    event_time: Math.floor(Date.now() / 1000),
    user_data: {
      em: builderEmail ? [builderEmail] : undefined,
      ph: builderPhone ? [builderPhone] : undefined,
      client_ip_address: builderIp,
      client_user_agent: builderUa
    },
    custom_data: (builderValue || builderCurrency) ? {
      value: builderValue,
      currency: builderCurrency,
      ...customObj
    } : customObj
  }, null, 2);
}
