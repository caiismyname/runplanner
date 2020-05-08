import React from 'react';
import PropTypes from 'prop-types';
import { Box, Heading, Button } from 'grommet';
import { Services } from 'grommet-icons';
import { appName } from './configs';

class HeaderModule extends React.Component {
    static propTypes = {
        name: PropTypes.string.isRequired,
        toggleSettingsPageFunc: PropTypes.func.isRequired,
	};

    render() {
        return (
            <Box
                align='end'
                gridArea='header'
                pad='xsmall'
                background='light-2'
            >
                <Heading level={1} margin='none' size='small'>
                    {appName}
                </Heading>
                <Box direction='row' gap='small'>
                    <Services 
                        style={{cursor: 'grab'}}
                        onClick={() => this.props.toggleSettingsPageFunc()}
                    />
                    <Heading level={3} margin='none' size='xsmall'>
                        {this.props.name}
                    </Heading>
                </Box>
            </Box>
        );
    }
}

export default HeaderModule;