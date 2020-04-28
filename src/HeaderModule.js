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
                pad='small'
                background='light-2'
            >
                <Heading level={1} margin='none'>
                    {appName}
                </Heading>
                <Box direction='row'>
                    {/* <Button icon={<Services />} background='black' /> */}
                    <Services 
                        style={{cursor: 'grab'}}
                        onClick={() => this.props.toggleSettingsPageFunc()}
                        pad={{right: 'small'}}
                    />
                    <Heading level={3} margin='none'>
                        {this.props.name}
                    </Heading>
                </Box>
            </Box>
        );
    }
}

export default HeaderModule;