import {FormControl, FormLabel, Input} from '@chakra-ui/react'
import {DayPicker, useInput as useDayInput, UseInputOptions} from 'react-day-picker'
import {useEffect} from 'react'
import 'react-day-picker/style.css'

export interface DateFilterProps {
  label?: string
  onChange: (value?: string) => void
  value?: string
  styles?: {[style: string]: any}
  inputStyles?: {[style: string]: any}
  required?: boolean
}

export default function DateFilter (props: DateFilterProps) {
  const {inputStyles, label, onChange, required, styles, value} = props
  const dayInputOptions: UseInputOptions = {required, format: 'yyyy-MM-dd'}
  const {dayPickerProps, fieldProps} = useDayInput(dayInputOptions)

  // a bit of a hack, since react-day-picker doesn't expose a way to hook into the event handlers
  useEffect(() => {
    if (value != fieldProps.value && dayPickerProps.selected) onChange(fieldProps.value)
    if (value && !dayPickerProps.selected) onChange(undefined)
  })

  return (
    <FormControl {...styles}>
      {label && <FormLabel>{label}</FormLabel>}
      <Input placeholder="YYYY-MM-DD" {...inputStyles} {...fieldProps} />
      <DayPicker {...dayPickerProps} />
    </FormControl>
  )
}
