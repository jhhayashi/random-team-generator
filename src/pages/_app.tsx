import {ChakraProvider, extendTheme} from '@chakra-ui/react'
import {AppProps} from 'next/app'

const config = {useSystemColorMode: true}
const theme = extendTheme({config})

function MyApp({Component, pageProps}: AppProps) {
  return (
    <ChakraProvider theme={theme}>
      <Component {...pageProps} />
    </ChakraProvider>
  )
}

export default MyApp
