import React from 'react';

const UserContext = React.createContext({
    ownerID: "",
    ownerName: "",
});

function UserProvider(props) {
    
    // return some "wait" indicator if no user loaded yet
    const loadedUser = {
        ownerID: "5ded9ddfb2e5872a93e21989",
        ownerName: "David from hooks",
    };

    return (
        <UserContext.Provider value={loadedUser} {...props}/>
    );

    // return (
    //     <UserContext.Provider value={null} {...props}/>
    // );
}

// Exporting a useContext hook so the 'App' function component 
// can access the user and decide whether to show login vs. app.
const useUser = () => React.useContext(UserContext);

export {UserProvider, UserContext, useUser};