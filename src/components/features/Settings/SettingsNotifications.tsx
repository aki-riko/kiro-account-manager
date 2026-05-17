import { Card, CardContent } from '../../ui/card'
import ToggleRow from './ToggleRow'

interface SettingsNotificationsProps {
  notifyActionRequired: boolean
  setNotifyActionRequired: (v: boolean) => void
  notifyFailure: boolean
  setNotifyFailure: (v: boolean) => void
  notifySuccess: boolean
  setNotifySuccess: (v: boolean) => void
  notifyBilling: boolean
  setNotifyBilling: (v: boolean) => void
  telemetryContentCollection: boolean
  setTelemetryContentCollection: (v: boolean) => void
  telemetryUsageAnalytics: boolean
  setTelemetryUsageAnalytics: (v: boolean) => void
  telemetryEditStats: boolean
  setTelemetryEditStats: (v: boolean) => void
  telemetryFeedback: boolean
  setTelemetryFeedback: (v: boolean) => void
  handleNotificationChange: (key: string, checked: boolean, setter: (v: boolean) => void) => Promise<void>
  handleTelemetryChange: (ideKey: string, checked: boolean, setter: (v: boolean) => void, appField: string) => Promise<void>
  t: (key: string) => string
}

function SettingsNotifications({
  notifyActionRequired,
  setNotifyActionRequired,
  notifyFailure,
  setNotifyFailure,
  notifySuccess,
  setNotifySuccess,
  notifyBilling,
  setNotifyBilling,
  telemetryContentCollection,
  setTelemetryContentCollection,
  telemetryUsageAnalytics,
  setTelemetryUsageAnalytics,
  telemetryEditStats,
  setTelemetryEditStats,
  telemetryFeedback,
  setTelemetryFeedback,
  handleNotificationChange,
  handleTelemetryChange,
  t,
}: SettingsNotificationsProps) {
  const notificationRows = [
    { key: 'kiroAgent.notifications.agent.actionRequired', label: 'settings.notifyActionRequired', value: notifyActionRequired, setter: setNotifyActionRequired },
    { key: 'kiroAgent.notifications.agent.failure', label: 'settings.notifyFailure', value: notifyFailure, setter: setNotifyFailure },
    { key: 'kiroAgent.notifications.agent.success', label: 'settings.notifySuccess', value: notifySuccess, setter: setNotifySuccess },
    { key: 'kiroAgent.notifications.billing', label: 'settings.notifyBilling', value: notifyBilling, setter: setNotifyBilling },
  ]

  const telemetryRows = [
    { ideKey: 'telemetry.dataSharingAndPromptLogging.contentCollectionForServiceImprovement', appField: 'telemetryContentCollection', label: 'settings.telemetryContentCollection', value: telemetryContentCollection, setter: setTelemetryContentCollection },
    { ideKey: 'telemetry.dataSharingAndPromptLogging.usageAnalyticsAndPerformanceMetrics', appField: 'telemetryUsageAnalytics', label: 'settings.telemetryUsageAnalytics', value: telemetryUsageAnalytics, setter: setTelemetryUsageAnalytics },
    { ideKey: 'telemetry.editStats.enabled', appField: 'telemetryEditStats', label: 'settings.telemetryEditStats', value: telemetryEditStats, setter: setTelemetryEditStats },
    { ideKey: 'telemetry.feedback.enabled', appField: 'telemetryFeedback', label: 'settings.telemetryFeedback', value: telemetryFeedback, setter: setTelemetryFeedback },
  ]

  return (
    <div className="space-y-3">
      {/* 通知设置 */}
      <Card className="card-glow animate-slide-in-left delay-150">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <h2 className="text-sm font-semibold text-foreground">{t('settings.notifications')}</h2>
            <span className="text-xs text-muted-foreground">{t('settings.notificationsDesc')}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {notificationRows.map(row => (
              <ToggleRow
                key={row.key}
                checked={row.value}
                onChange={checked => handleNotificationChange(row.key, checked, row.setter)}
                label={t(row.label)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 遥测与隐私 */}
      <Card className="card-glow animate-slide-in-left delay-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <h2 className="text-sm font-semibold text-foreground">{t('settings.telemetry')}</h2>
            <span className="text-xs text-muted-foreground">{t('settings.telemetryDesc')}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {telemetryRows.map(row => (
              <ToggleRow
                key={row.ideKey}
                checked={row.value}
                onChange={checked => handleTelemetryChange(row.ideKey, checked, row.setter, row.appField)}
                label={t(row.label)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsNotifications
