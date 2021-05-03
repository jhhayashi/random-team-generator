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
  Select,
  Wrap,
} from '@chakra-ui/react'

import CheckboxFilter from '../components/CheckboxFilter'
import DateFilter from '../components/DateFilter'
import NumberFilter from '../components/NumberFilter'
import MultiselectFilter from '../components/MultiselectFilter'
import {APIFilters, APIGroups, Filter, Integration, User as UserType} from '../../types'

function User(props: UserType) {
  const {name, imgUrl} = props
  return (
    <Box maxW="sm" p={4} borderWidth="1px" borderRadius="lg" overflow="hidden" boxShadow="md">
      <Center><Image boxSize="175px" src={imgUrl} /></Center>
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

function renderAllGroups(users: UserType[][]) {
  return users.map((group, i) => (
    <div key={i}>
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

const staticFilters: Filter[] = [
  {
    type: "number",
    name: "groupCount",
    label:"Number of groups (set to 0 to return all users in groups)",
    min: 0,
    defaultValue: 1,
  },
  {
    type: "number",
    name: "maxGroupSize",
    label:"(Maximum) Number of users to return per group (set to 0 to return all users in the number of groups specified above)",
    min: 0,
    defaultValue: 1,
  },
]

export default function Home() {
  const [randomUsers, setRandomUsers] = useState<UserType[][] | null>(null)
  const [isLoadingRandomUsers, setIsLoadingRandomUsers] = useState(false)
  const [availableFilters, setAvailableFilters] = useState<Filter[]>([])
  const [filterState, setFilterState] = useState<{[filterName: string]: any}>({})
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [activeIntegration, setActiveIntegration] = useState<Integration | null>(null)

  function fetchRandomGroups(){
    if (!activeIntegration) {
      setRandomUsers(null)
      return
    }
    const dynamicFilters = _.mapValues(filterState, formatFilterValues)
    const queryStringArgs = _.omitBy(
      dynamicFilters,
      (val: any) => val == null || (_.isArray(val) && !val.length) || (_.isNumber(val) && (val < 1))
    )
    const q = queryString.stringify(queryStringArgs, {arrayFormat: 'bracket'})
    setIsLoadingRandomUsers(true)
    setRandomUsers(null)
    fetch(`${activeIntegration.apiPrefix}/groups?${q}`)
      .then(res => res.json())
      .then((randomUsers: APIGroups) => {
        setIsLoadingRandomUsers(false)
        setRandomUsers(randomUsers.groups)
      })
      .catch(() => {
        setIsLoadingRandomUsers(false)
        setRandomUsers(null)
      })
  }

  useEffect(fetchRandomGroups, [filterState])

  // integrations
  useEffect(() => {
    fetch('/api/integrations')
      .then(res => res.json())
      .then((integrationList: Integration[]) => {
        setIntegrations(integrationList)
      })
  }, [])
  function handleIntegrationChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const integrationName = e.target.value
    const newActiveIntegration = integrations.filter(({name}) => name == integrationName)[0]
    setActiveIntegration(newActiveIntegration || null)
  }

  // dynamic filters
  useEffect(() => {
    if (!activeIntegration) {
      setAvailableFilters([])
      setFilterState({})
      return
    }
    fetch(`${activeIntegration.apiPrefix}/filters`)
      .then(res => res.json())
      .then((dynamicFilters: APIFilters) => {
        const filters = [...staticFilters, ...dynamicFilters]
        setAvailableFilters(filters)
        setFilterState(
          _.fromPairs(
            filters.map(({name, type, defaultValue}) => ([name, defaultValue || (type == 'multiselect' ? [] : undefined)]))
          )
        )
      })
  }, [activeIntegration])

  const controls = (
    <Box>
      <Select placeholder="Select Integration" size="lg" onChange={handleIntegrationChange}>
        {integrations.map(({name})=> <option key={name} value={name}>{name}</option>)}
      </Select>
      {availableFilters.map(({name, label, type, url}) => (
        <React.Fragment key={name}>
          {type == 'multiselect' && <MultiselectFilter
            name={name}
            url={url}
            label={label}
            value={filterState[name]}
            onChange={newVal => setFilterState({...filterState, [name]: newVal})}
            inputStyles={{maxW: 400}}
            listStyles={{maxW: 400}}
          />}
          {type == 'checkbox' && <CheckboxFilter
            label={label}
            value={filterState[name]}
            onChange={newVal => setFilterState({...filterState, [name]: newVal})}
          />}
          {type == 'date' && <DateFilter
            inputStyles={{maxW: 400}}
            label={label}
            value={filterState[name]}
            onChange={newVal => setFilterState({...filterState, [name]: newVal})}
          />}
          {type == 'number' && <NumberFilter
            label={label}
            inputStyles={{maxW: 400}}
            value={filterState[name]}
            onChange={newVal => setFilterState({...filterState, [name]: +newVal})}
          />}
        </React.Fragment>
      ))}
      <Button my={4} onClick={fetchRandomGroups}>Reroll</Button>
    </Box>
  )

  return (
    <Box as="main" p={4}>
      <Heading as="h1" mb={4}size="2xl">Random Team Generator</Heading>
      {controls}
      <Divider my={4} />
      <Wrap justify="center" direction="column" spacing={8}>
        {!activeIntegration && <Heading as="h3" size="lg">Select an Integration to begin</Heading>}
        {isLoadingRandomUsers && <p>Loading...</p>}
        {randomUsers && renderAllGroups(randomUsers)}
      </Wrap>
    </Box>
  )
}
