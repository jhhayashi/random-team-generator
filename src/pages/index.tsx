import * as React from "react"
import {useCallback, useState, useEffect} from 'react'
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

import NumberFilter from '../components/NumberFilter'
import {APIv1Groups, User as UserType} from '../../types'

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

export default function Home() {
  const [randomUsers, setRandomUsers] = useState<UserType[][] | null>(null)
  const [maxGroupSize, setMaxGroupSize] = useState(1)
  const [groupCount, setGroupCount] = useState(1)

  const getData = useCallback(() => {
    const queryStringArgs = {
      ...(groupCount ? {groupCount} : {}),
      ...(maxGroupSize ? {maxGroupSize} : {}),
    }
    const q = queryString.stringify(queryStringArgs, {arrayFormat: 'bracket'})
    fetch(`/api/bamboo/v1/groups?${q}`)
      .then(res => res.json())
      .then((randomUsers: APIv1Groups) => {
        setRandomUsers(randomUsers.groups)
      })
  }, [maxGroupSize, groupCount])

  useEffect(() => {
    getData()
  }, [maxGroupSize, groupCount, getData])

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
