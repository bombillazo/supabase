import ShimmeringLoader from 'components/ui/ShimmeringLoader'
import { DataPoint } from 'data/analytics/constants'
import { useInfraMonitoringQuery } from 'data/analytics/infra-monitoring-query'
import { useProjectSubscriptionQuery } from 'data/subscriptions/project-subscription-query'
import dayjs from 'dayjs'
import { PRICING_TIER_PRODUCT_IDS } from 'lib/constants'
import Link from 'next/link'
import { Alert, Button } from 'ui'
import SectionContent from './SectionContent'
import SectionHeader from './SectionHeader'
import { COMPUTE_INSTANCE_SPECS, USAGE_CATEGORIES } from './Usage.constants'
import { getUpgradeUrl } from './Usage.utils'
import UsageBarChart from './UsageBarChart'

export interface InfrastructureProps {
  projectRef: string
}

// [Joshen] Need to update the IO budget chart to show burst mbps and duration next time

const Infrastructure = ({ projectRef }: InfrastructureProps) => {
  const { data: subscription } = useProjectSubscriptionQuery({ projectRef })
  const { current_period_start, current_period_end } = subscription?.billing ?? {}
  const startDate =
    current_period_start !== undefined
      ? new Date(current_period_start * 1000).toISOString()
      : undefined
  const endDate =
    current_period_end !== undefined ? new Date(current_period_end * 1000).toISOString() : undefined
  const categoryMeta = USAGE_CATEGORIES.find((category) => category.key === 'infra')

  const upgradeUrl = getUpgradeUrl(projectRef, subscription)
  const isFreeTier = subscription?.tier.supabase_prod_id === PRICING_TIER_PRODUCT_IDS.FREE
  const currentComputeInstance = subscription?.addons.find((addon) =>
    addon.supabase_prod_id.includes('_instance_')
  )
  const currentComputeInstanceSpecs =
    COMPUTE_INSTANCE_SPECS[currentComputeInstance?.supabase_prod_id ?? 'addon_instance_micro']

  const { data: cpuUsageData, isLoading: isLoadingCpuUsageData } = useInfraMonitoringQuery({
    projectRef,
    attribute: 'cpu_usage',
    interval: '1d',
    startDate,
    endDate,
  })

  const { data: memoryUsageData, isLoading: isLoadingMemoryUsageData } = useInfraMonitoringQuery({
    projectRef,
    attribute: 'ram_usage',
    interval: '1d',
    startDate,
    endDate,
  })

  const { data: ioBudgetData, isLoading: isLoadingIoBudgetData } = useInfraMonitoringQuery({
    projectRef,
    attribute: 'disk_io_budget',
    interval: '1d',
    startDate,
    endDate,
  })

  const currentDayIoBudget = Number(
    ioBudgetData?.data.find((x) => x.periodStartFormatted === dayjs().format('DD MMM'))?.[
      'disk_io_budget'
    ] ?? 100
  )

  const chartMeta: { [key: string]: { data: DataPoint[]; isLoading: boolean } } = {
    cpu_usage: {
      isLoading: isLoadingCpuUsageData,
      data: cpuUsageData?.data ?? [],
    },
    ram_usage: {
      isLoading: isLoadingMemoryUsageData,
      data: memoryUsageData?.data ?? [],
    },
    disk_io_budget: {
      isLoading: isLoadingIoBudgetData,
      data: ioBudgetData?.data ?? [],
    },
  }

  if (categoryMeta === undefined) return null

  return (
    <>
      <SectionHeader title={categoryMeta.name} description={categoryMeta.description} />
      {categoryMeta.attributes.map((attribute) => {
        const chartData = chartMeta[attribute.key]?.data ?? []

        // [Joshen] Ideally this should come from the API imo, foresee some discrepancies
        const lastZeroValue = chartData.find(
          (x: any) => x.loopId > 0 && x[attribute.attribute] === 0
        )
        const lastKnownValue =
          lastZeroValue !== undefined
            ? dayjs(lastZeroValue.period_start)
                .subtract(1, 'day')
                .format('DD MMM YYYY, HH:mma (ZZ)')
            : undefined

        return (
          <div id={attribute.anchor} key={attribute.key}>
            <SectionContent section={attribute} lastKnownValue={lastKnownValue}>
              {attribute.key === 'disk_io_budget' && (
                <>
                  {currentDayIoBudget <= 0 ? (
                    <Alert withIcon variant="danger" title="IO Budget for today has been used up">
                      <p className="mb-4">
                        Your workload has used up all the burst IO throughput minutes during the day
                        and is running at the baseline performance. If you need consistent disk
                        performance, consider upgrading to a larger compute add-on.
                      </p>
                      <Link href={upgradeUrl}>
                        <a>
                          <Button type="danger">
                            {isFreeTier ? 'Upgrade project' : 'Change compute add-on'}
                          </Button>
                        </a>
                      </Link>
                    </Alert>
                  ) : currentDayIoBudget <= 20 ? (
                    <Alert withIcon variant="warning" title="IO Budget for today is running out">
                      <p className="mb-4">
                        Your workload is about to use up all the burst IO throughput minutes during
                        the day. Once this is completely used up, your workload will run at the
                        baseline performance. If you need consistent disk performance, consider
                        upgrading to a larger compute add-on.
                      </p>
                      <Link href={upgradeUrl}>
                        <a>
                          <Button type="warning">
                            {isFreeTier ? 'Upgrade project' : 'Change compute add-on'}
                          </Button>
                        </a>
                      </Link>
                    </Alert>
                  ) : null}
                  <div className="space-y-1">
                    <p>What is Disk IO Bandwidth?</p>
                    <p className="text-sm text-scale-1000">
                      Smaller compute instances can burst up to the maximum disk IO bandwidth for 30
                      minutes in a day. Beyond that, the performance reverts to the baseline disk IO
                      bandwidth.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm mb-2">Overview</p>
                    <div className="flex items-center justify-between border-b py-1">
                      <p className="text-xs text-scale-1000">Current compute instance</p>
                      <p className="text-xs">{currentComputeInstance?.name ?? 'Micro'}</p>
                    </div>
                    <div className="flex items-center justify-between border-b py-1">
                      <p className="text-xs text-scale-1000">Maximum IO Bandwidth (burst limit)</p>
                      <p className="text-xs">
                        {currentComputeInstanceSpecs.maxBandwidth.toLocaleString()} Mbps
                      </p>
                    </div>
                    <div className="flex items-center justify-between border-b py-1">
                      <p className="text-xs text-scale-1000">Baseline IO Bandwidth</p>
                      <p className="text-xs">
                        {currentComputeInstanceSpecs.baseBandwidth.toLocaleString()} Mbps
                      </p>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <p className="text-xs text-scale-1000">Daily burst time limit</p>
                      <p className="text-xs">30 mins</p>
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-1">
                {attribute.key === 'disk_io_budget' ? (
                  <p>IO Budget remaining each day</p>
                ) : (
                  <p>
                    Max{' '}
                    <span className={attribute.key === 'ram_usage' ? 'lowercase' : ''}>
                      {attribute.name}
                    </span>{' '}
                    usage each day
                  </p>
                )}
                {attribute.chartDescription.split('\n').map((paragraph, idx) => (
                  <p key={`para-${idx}`} className="text-sm text-scale-1000">
                    {paragraph}
                  </p>
                ))}
              </div>
              {chartMeta[attribute.key].isLoading ? (
                <div className="space-y-2">
                  <ShimmeringLoader />
                  <ShimmeringLoader className="w-3/4" />
                  <ShimmeringLoader className="w-1/2" />
                </div>
              ) : (
                <UsageBarChart
                  name={attribute.name}
                  unit={attribute.unit}
                  attribute={attribute.attribute}
                  data={chartData}
                  yFormatter={(value) => `${value}%`}
                  yLimit={100}
                />
              )}
            </SectionContent>
          </div>
        )
      })}
    </>
  )
}

export default Infrastructure
