import { useState } from 'react'
import { Button, Input, Listbox } from 'ui'
import { useRouter } from 'next/router'

import { API_URL, PRICING_TIER_LABELS_ORG } from 'lib/constants'
import { useStore } from 'hooks'
import { post } from 'lib/common/fetch'
import Panel from 'components/ui/Panel'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'

const ORG_KIND_TYPES = {
  PERSONAL: 'Personal',
  EDUCATIONAL: 'Educational',
  STARTUP: 'Startup',
  AGENCY: 'Agency',
  COMPANY: 'Company',
  UNDISCLOSED: 'N/A',
}
const ORG_KIND_DEFAULT = 'PERSONAL'

const ORG_SIZE_TYPES = {
  '1': '1 - 10',
  '10': '10 - 49',
  '50': '50 - 99',
  '100': '100 - 299',
  '300': 'More than 300',
}
const ORG_SIZE_DEFAULT = '1'

/**
 * No org selected yet, create a new one
 */
const NewOrgForm = () => {
  const { ui, app } = useStore()
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()

  const [orgName, setOrgName] = useState('')
  const [orgKind, setOrgKind] = useState(ORG_KIND_DEFAULT)
  const [orgSize, setOrgSize] = useState(ORG_SIZE_DEFAULT)
  const [newOrgLoading, setNewOrgLoading] = useState(false)

  const [dbPricingTierKey, setDbPricingTierKey] = useState('PRO')

  function validateOrgName(name: any) {
    const value = name ? name.trim() : ''
    return value.length >= 1
  }

  function onOrgNameChange(e: any) {
    setOrgName(e.target.value)
  }

  function onOrgKindChange(value: any) {
    setOrgKind(value)
  }

  function onOrgSizeChange(value: any) {
    setOrgSize(value)
  }

  function onDbPricingPlanChange(value: string) {
    setDbPricingTierKey(value)
  }

  async function createOrg(paymentMethod: string) {
    const response = await post(
      `${API_URL}/organizations`,
      {
        name: orgName,
        kind: orgKind,
        payment_method: paymentMethod,
        tier: 'tier_pro',
        ...(orgKind == 'COMPANY' ? { size: orgSize } : {}),
      },
      {
        headers: {
          Version: '2',
        },
      }
    )

    if (response.error) {
      setNewOrgLoading(false)
      ui.setNotification({
        category: 'error',
        message: `Failed to create organization: ${response.error?.message ?? response.error}`,
      })
    } else {
      const org = response
      app.onOrgAdded(org)
      router.push(`/new/${org.slug}`)
    }
  }

  const handleSubmit = async (event: any) => {
    event.preventDefault()

    const isOrgNameValid = validateOrgName(orgName)
    if (!isOrgNameValid) {
      ui.setNotification({ category: 'error', message: 'Organization name is empty' })
      return
    }

    if (!stripe || !elements) {
      console.error('Stripe.js has not loaded')
      return
    }
    setNewOrgLoading(true)

    if (document !== undefined) {
      // [Joshen] This is to ensure that any 3DS popup from Stripe remains clickable
      document.body.classList.add('!pointer-events-auto')
    }

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: 'http://localhost:8082/new-with-subscription' },
    })

    if (error || !setupIntent.payment_method) {
      ui.setNotification({
        category: 'error',
        message: error?.message ?? ' Failed to save card details',
      })
      return
    }

    const paymentMethod = setupIntent.payment_method as string

    await createOrg(paymentMethod)

    if (document !== undefined) {
      document.body.classList.remove('!pointer-events-auto')
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Panel
          hideHeaderStyling
          title={
            <div key="panel-title">
              <h4>Create a new organization</h4>
            </div>
          }
          footer={
            <div key="panel-footer" className="flex w-full items-center justify-between">
              <Button type="default" onClick={() => router.push('/projects')}>
                Cancel
              </Button>
              <div className="flex items-center space-x-3">
                <p className="text-xs text-scale-900">You can rename your organization later</p>
                <Button
                  block
                  htmlType="submit"
                  type="primary"
                  loading={newOrgLoading}
                  disabled={newOrgLoading}
                >
                  Create organization
                </Button>
              </div>
            </div>
          }
        >
          <Panel.Content className="pt-0">
            <p className="text-sm">This is your organization within Supabase.</p>
            <p className="text-sm text-scale-1100">
              For example, you can use the name of your company or department.
            </p>
          </Panel.Content>
          <Panel.Content className="Form section-block--body has-inputs-centered">
            <Input
              autoFocus
              label="Name"
              type="text"
              layout="horizontal"
              placeholder="Organization name"
              descriptionText="What's the name of your company or team?"
              value={orgName}
              onChange={onOrgNameChange}
            />
          </Panel.Content>
          <Panel.Content className="Form section-block--body has-inputs-centered">
            <Listbox
              label="Type of organization"
              layout="horizontal"
              value={orgKind}
              onChange={onOrgKindChange}
              descriptionText="What would best describe your organization?"
            >
              {Object.entries(ORG_KIND_TYPES).map(([k, v]) => {
                return (
                  <Listbox.Option key={k} label={v} value={k}>
                    {v}
                  </Listbox.Option>
                )
              })}
            </Listbox>
          </Panel.Content>

          {orgKind == 'COMPANY' ? (
            <Panel.Content className="Form section-block--body has-inputs-centered">
              <Listbox
                label="Company size"
                layout="horizontal"
                value={orgSize}
                onChange={onOrgSizeChange}
                descriptionText="How many people are in your company?"
              >
                {Object.entries(ORG_SIZE_TYPES).map(([k, v]) => {
                  return (
                    <Listbox.Option key={k} label={v} value={k}>
                      {v}
                    </Listbox.Option>
                  )
                })}
              </Listbox>
            </Panel.Content>
          ) : (
            <></>
          )}

          <Panel.Content>
            <Listbox
              label="Pricing Plan"
              layout="horizontal"
              value={dbPricingTierKey}
              // @ts-ignore
              onChange={onDbPricingPlanChange}
              // @ts-ignore
              descriptionText={
                <>
                  Select a plan that suits your needs.&nbsp;
                  <a
                    className="underline"
                    target="_blank"
                    rel="noreferrer"
                    href="https://supabase.com/pricing"
                  >
                    More details
                  </a>
                </>
              }
            >
              {Object.entries(PRICING_TIER_LABELS_ORG).map(([k, v]) => {
                const label = `${v}${k === 'PRO' ? ' - $25/month' : ' - $0/month'}`
                return (
                  <Listbox.Option key={k} label={label} value={k}>
                    {label}
                  </Listbox.Option>
                )
              })}
            </Listbox>
          </Panel.Content>

          <PaymentElement />
        </Panel>
      </form>
    </>
  )
}

export default NewOrgForm
