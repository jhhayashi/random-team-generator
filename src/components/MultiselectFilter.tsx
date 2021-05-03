import {useEffect, useState} from 'react'
import {
  Avatar,
  BoxProps,
  Flex,
  FormControl,
  FormControlProps,
  InputProps,
  Text,
} from '@chakra-ui/react'
import { CUIAutoComplete, Item as CUIDropdownItem } from 'chakra-ui-autocomplete'

import {Filter, MultiselectFilterOption} from '../../types'

interface DropdownItem extends CUIDropdownItem {
  value: string
  label: string
  imgUrl?: string
}

function renderDropdownItem(item: DropdownItem) {
  return (
    <Flex flexDir="row" alignItems="center">
      <Avatar mr={2} size="sm" name={item.label} src={item.imgUrl} />
      <Text>{item.label}</Text>
    </Flex>
  )
}

export interface MultiselectFilterProps extends Partial<Omit<Filter, 'type'>>{
  onChange: (value: any[]) => void
  value: any[]
  styles?: FormControlProps
  inputStyles?: InputProps
  listStyles?: BoxProps
  options?: MultiselectFilterOption[]
  required?: boolean

  // from Filter
  name: string
  label?: string
  url?: string
}

export default function MultiselectFilter(props: MultiselectFilterProps) {
  const {inputStyles, label, listStyles, name, onChange, options: propOptions, required, styles, url, value} = props
  const [options, setOptions] = useState(propOptions)

  if (url) {
    useEffect(() => {
      fetch(url)
        .then(res => res.json())
        .then((options: MultiselectFilterOption[]) => setOptions(options))
    }, [url])
  }

  return (
    <FormControl required={required} {...styles}>
      {options && (
          <CUIAutoComplete
            inputStyleProps={inputStyles}
            label={label || `Filter by ${name}`}
            placeholder={options ? "Start typing to filter" : "Loading..."}
            items={options?.map(({name, imgUrl, value})=> ({value: value || name, label: name, imgUrl}))}
            selectedItems={value || []}
            onSelectedItemsChange={changes => {
              if (changes.selectedItems) onChange(changes.selectedItems)
            }}
            itemRenderer={renderDropdownItem}
            listStyleProps={{color: "black", ...listStyles}}
            toggleButtonStyleProps={{display: 'none'}}
          />
      )}
    </FormControl>
  )
}
