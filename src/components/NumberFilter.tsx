import {
  FormControl,
  FormLabel,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from '@chakra-ui/react'

export interface NumberFilterProps {
  label?: string
  min?: number
  step?: number
  onChange: (value: string) => void
  value: number
  styles?: {[style: string]: any}
  inputStyles?: {[style: string]: any}
}

export default function NumberFilter(props: NumberFilterProps) {
  const {inputStyles, label, min, step = 1, onChange, styles, value} = props
  return (
      <FormControl {...styles}>
        {label && <FormLabel>{label}</FormLabel>}
        <NumberInput {...inputStyles} min={min} step={step} onChange={onChange} value={value}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
      </FormControl>
  )
}
