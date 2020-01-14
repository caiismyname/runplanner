import React from 'react';
import App from './App'
import {UserProvider} from './user-context';

// Shell is what gets rendered into the ReactDOM.
// It subscribes to the context provider (UserProvider) as the top level component
// so all sub-components can have access as well.
function Shell() {
    return (
        <UserProvider>
            <App />
        </UserProvider>
    );
  }
  
  export default Shell;
  