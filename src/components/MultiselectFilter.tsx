import {useEffect, useState} from 'react'
import {
  Avatar,
  Flex,
  FormControl,
  Text,
} from '@chakra-ui/react'
import { CUIAutoComplete, Item as CUIDropdownItem } from 'chakra-ui-autocomplete'

import {Filter} from '../../types'

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

export interface MultiselectFilterOption {
  name: string
  imgUrl?: string
}

export interface MultiselectFilterProps extends Partial<Omit<Filter, 'type'>>{
  onChange: (value: any[]) => void
  value: any[]
  styles?: {[style: string]: any}
  inputStyles?: {[style: string]: any}
  options?: MultiselectFilterOption[]

  // from Filter
  name: string
  label?: string
  url?: string
}

export default function MultiselectFilter(props: MultiselectFilterProps) {
  const {inputStyles, label, name, onChange, options: propOptions, styles, url, value} = props
  const [options, setOptions] = useState(propOptions)

  if (url) {
    useEffect(() => {
      fetch(url)
        .then(res => res.json())
        .then((options: MultiselectFilterOption[]) => setOptions(options))
    }, [url])
  }

  return (
    <FormControl {...styles}>
      {options && (
          <CUIAutoComplete
            inputStyleProps={inputStyles}
            label={label || `Filter by ${name}`}
            placeholder={options ? "Start typing to filter" : "Loading..."}
            items={options?.map(({name, imgUrl})=> ({value: name, label: name, imgUrl}))}
            selectedItems={value || []}
            onSelectedItemsChange={changes => {
              if (changes.selectedItems) onChange(changes.selectedItems)
            }}
            itemRenderer={renderDropdownItem}
            listStyleProps={{color: "black"}}
          />
      )}
    </FormControl>
  )
}
