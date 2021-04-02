import {Checkbox} from '@chakra-ui/react'

export interface CheckboxFilterProps {
  label?: string
  onChange: (value: boolean) => void
  value: boolean
  styles?: {[style: string]: any}
}

export default function CheckboxFilter(props: CheckboxFilterProps) {
  const {label, onChange, styles, value} = props
  return (
    <Checkbox {...styles} isChecked={value} onChange={() => onChange(!value)}>{label}</Checkbox>
  )
}
