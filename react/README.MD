# Merchant payment example React

React example application to integrate payment using [@nitropay-io/sdk](https://www.npmjs.com/package/@nitropay-io/sdk).

## Usage

clone repo and cd into the react folder

```
git clone https://github.com/nitropay-io/merchant-payment-examples.git
```

```
cd merchant-payment-examples/react/
```

#### Server

install dependencies
```
cd server
yarn install
```

set env configuration
```
# Base URL for the NitroPay API Provider
NITROPAY_API_BASE=https://api.nitropay.io
# public API key (find it in your Backoffice : Settings > Developer)
NITROPAY_API_PUBLIC_KEY=pk_xxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# secret API key (DO NOT DISCLOSE ! Backoffice : Settings > Developer)
NITROPAY_API_SECRET_KEY=sk_xxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# Local dev server port, no need to change unless conflicting with another of your apps
PORT=4000
```

start server

```
yarn start
```

#### Client


```
// cwd : path/to/merchant-payment-examples/react/
cd client
yarn install
```

create and edit .env file
```
mv .env.example .env

# the previously setup merchant API
VITE_MERCHANT_SERVER=http://localhost:4000

# your public key
VITE_NITROPAY_PUBLIC_KEY=pk_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

```

start client

```
yarn dev 
```

navigate to http://localhost:5173