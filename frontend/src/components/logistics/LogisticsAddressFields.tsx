import { Input } from '../ui/Input'

export interface InlineAddressFormValues {
  label: string
  recipient_name: string
  line1: string
  line2: string
  community: string
  parish: string
  contact_number: string
  delivery_notes: string
}

export const emptyInlineAddress = (): InlineAddressFormValues => ({
  label: '',
  recipient_name: '',
  line1: '',
  line2: '',
  community: '',
  parish: '',
  contact_number: '',
  delivery_notes: '',
})

interface LogisticsAddressFieldsProps {
  idPrefix: string
  values: InlineAddressFormValues
  onChange: (values: InlineAddressFormValues) => void
  parishes: string[]
  defaultContactNumber?: string
  defaultLabel?: string
}

export function LogisticsAddressFields({
  idPrefix,
  values,
  onChange,
  parishes,
  defaultContactNumber,
  defaultLabel,
}: LogisticsAddressFieldsProps) {
  function set(field: keyof InlineAddressFormValues, value: string) {
    onChange({ ...values, [field]: value })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-label`} className="mb-1 block text-xs font-semibold text-muted">
            Label
          </label>
          <Input
            id={`${idPrefix}-label`}
            value={values.label}
            placeholder={defaultLabel ?? 'Address label'}
            onChange={(e) => set('label', e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}-recipient`}
            className="mb-1 block text-xs font-semibold text-muted"
          >
            Recipient name
          </label>
          <Input
            id={`${idPrefix}-recipient`}
            value={values.recipient_name}
            placeholder="Who receives at this location"
            onChange={(e) => set('recipient_name', e.target.value)}
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-line1`} className="mb-1 block text-xs font-semibold text-muted">
          Street address
        </label>
        <Input
          id={`${idPrefix}-line1`}
          value={values.line1}
          placeholder="Street, building, or landmark"
          onChange={(e) => set('line1', e.target.value)}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-line2`} className="mb-1 block text-xs font-semibold text-muted">
            Apt / unit (optional)
          </label>
          <Input
            id={`${idPrefix}-line2`}
            value={values.line2}
            onChange={(e) => set('line2', e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}-community`}
            className="mb-1 block text-xs font-semibold text-muted"
          >
            Community / town
          </label>
          <Input
            id={`${idPrefix}-community`}
            value={values.community}
            onChange={(e) => set('community', e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-parish`} className="mb-1 block text-xs font-semibold text-muted">
            Parish
          </label>
          <select
            id={`${idPrefix}-parish`}
            value={values.parish}
            onChange={(e) => set('parish', e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">Select parish</option>
            {parishes.map((parish) => (
              <option key={parish} value={parish}>
                {parish}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}-contact`}
            className="mb-1 block text-xs font-semibold text-muted"
          >
            Contact number
          </label>
          <Input
            id={`${idPrefix}-contact`}
            value={values.contact_number}
            placeholder={defaultContactNumber ?? '876…'}
            onChange={(e) => set('contact_number', e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-notes`} className="mb-1 block text-xs font-semibold text-muted">
          Delivery notes (optional)
        </label>
        <Input
          id={`${idPrefix}-notes`}
          value={values.delivery_notes}
          placeholder="Gate code, landmarks, etc."
          onChange={(e) => set('delivery_notes', e.target.value)}
        />
      </div>
    </div>
  )
}
