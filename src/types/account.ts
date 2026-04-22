export interface UsageBreakdown {
    freeTrialInfo?: {
        freeTrialExpiry: number;
        freeTrialStatus: 'ACTIVE' | 'EXPIRED' | string;
    };
    bonuses?: Array<{
        status: 'ACTIVE' | string;
        expiresAt: number;
    }>;
    nextDateReset?: number;
}

export interface AccountUsageData {
    usageBreakdownList?: UsageBreakdown[];
    nextDateReset?: number;
    subscriptionInfo?: {
        subscriptionTitle: string;
    };
}

export interface TagLink {
    tagId: string;
    tagName: string;
    linkedAt?: string;
}

export interface Account {
    id: string;
    email?: string;
    provider: string;
    refreshToken: string;
    accessToken?: string;
    label?: string;
    machineId?: string;
    groupId?: string;
    tagLinks?: TagLink[];
    usageData?: AccountUsageData;
    availableModelsCache?: {
        cachedAt: number;
        models: any[];
    };
    expiresAt?: string;
    status?: string;
    lastError?: string;
    refreshing?: boolean;
    // 扩展字段
    _index?: number;
}

export interface TagDefinition {
    id: string;
    name: string;
    color: string;
}

export interface GroupDefinition {
    id: string;
    name: string;
    color: string;
}
