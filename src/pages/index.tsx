import * as React from "react"
import * as _ from 'lodash'
import {useState, useEffect} from 'react'
import queryString from 'query-string'
import {
  Box,
  Button,
  Center,
  Divider,
  Heading,
  Image,
  Wrap,
} from '@chakra-ui/react'

import CheckboxFilter from '../components/CheckboxFilter'
import DateFilter from '../components/DateFilter'
import NumberFilter from '../components/NumberFilter'
import MultiselectFilter from '../components/MultiselectFilter'
import {APIv1Filters, APIv1Groups, Filter, User as UserType} from '../../types'

function User(props: UserType) {
  const {name, imgUrl} = props
  return (
    <Box maxW="sm" p={4} borderWidth="1px" borderRadius="lg" overflow="hidden" boxShadow="md">
      <Center><Image src={imgUrl} /></Center>
      <Divider mt={4} />
      <Box p="6" textAlign="left">
        <Heading as="h3" size="lg">{name}</Heading>
      </Box>
    </Box>
  )
}

function renderUserGroup(users: UserType[]) {
  return (
    <Wrap justify="center" direction="row" spacing={8}>
      {users.map(user => <User key={user.id} {...user} />)}
    </Wrap>
  )
}

function renderAllGroups(users: UserType[][] | null) {
  if (!users) return <p>Loading...</p>
  return users.map((group, i) => (
    <div>
      <Heading as="h3" mb={4}>Group {i + 1}</Heading>
      {renderUserGroup(group)}
      <Divider mt={4} />
    </div>
  ))
}

function formatFilterValues(val: any) {
  if (_.isArray(val)) return val.map(({value}) => value)
  return val
}

export default function Home() {
  const [randomUsers, setRandomUsers] = useState<UserType[][] | null>(null)
  const [maxGroupSize, setMaxGroupSize] = useState(1)
  const [groupCount, setGroupCount] = useState(1)
  const [availableFilters, setAvailableFilters] = useState<Filter[]>([])
  const [filterState, setFilterState] = useState<{[filterName: string]: any}>({})

  function getData(){
    const dynamicFilters = _.mapValues(filterState, formatFilterValues)
    const queryStringArgs = _.omitBy(
      {groupCount, maxGroupSize, ...dynamicFilters},
      (val: any) => val == null || (_.isArray(val) && !val.length) || (_.isNumber(val) && (val < 1))
    )
    const q = queryString.stringify(queryStringArgs, {arrayFormat: 'bracket'})
    fetch(`/api/bamboo/v1/groups?${q}`)
      .then(res => res.json())
      .then((randomUsers: APIv1Groups) => {
        setRandomUsers(randomUsers.groups)
      })
  }

  useEffect(getData, [maxGroupSize, groupCount, filterState])

  useEffect(() => {
    fetch('/api/bamboo/v1/filters')
      .then(res => res.json())
      .then((filters: APIv1Filters) => {
        setAvailableFilters(filters)
        setFilterState(
          _.fromPairs(
            filters.map(({name, type}) => ([name, type == 'multiselect' ? [] : undefined]))
          )
        )
      })
  }, [])

  const controls = (
    <Box>
      <NumberFilter
        label="Number of groups (set to 0 to return all users in groups)"
        inputStyles={{maxW: 400}}
        min={0}
        onChange={val => setGroupCount(+val)}
        value={groupCount}
      />
      <NumberFilter
        label="(Maximum) Number of users to return per group (set to 0 to return all users in the number of groups specified above)"
        inputStyles={{maxW: 400}}
        min={0}
        onChange={val => setMaxGroupSize(+val)}
        value={maxGroupSize}
      />
      {availableFilters.map(({name, label, type, url}) => (
        <>
          {type == 'multiselect' && <MultiselectFilter
            name={name}
            url={url}
            label={label}
            value={filterState[name]}
            onChange={newVal => setFilterState({...filterState, [name]: newVal})}
            inputStyles={{maxW: 400}}
          />}
          {type == 'checkbox' && <CheckboxFilter
            label={label}
            value={filterState[name]}
            onChange={newVal => setFilterState({...filterState, [name]: newVal})}
          />}
          {type == 'date' && <DateFilter
            label={label}
            value={filterState[name]}
            onChange={newVal => setFilterState({...filterState, [name]: newVal})}
          />}
        </>
      ))}
      <Button my={4} onClick={getData}>Reroll</Button>
    </Box>
  )

  return (
    <Box p={4}>
      <Heading as="h1" mb={4}size="2xl">Random Team Generator</Heading>
      {controls}
      <Divider my={4} />
      <Wrap justify="center" direction="column" spacing={8}>
        {renderAllGroups(randomUsers)}
      </Wrap>
    </Box>
  )
}
