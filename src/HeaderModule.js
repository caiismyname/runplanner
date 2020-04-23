import React from 'react';
import PropTypes from 'prop-types';
import { Box, Heading } from 'grommet';
import { appName } from './configs';

class HeaderModule extends React.Component {
    static propTypes = {
        name: PropTypes.string.isRequired,
	};

    render() {
        return (
            <Box
                align='end'
                gridArea='header'
                pad='small'
                background='light-2'
            >
                {/* <Heading level={1} margin='none'>
                    {appName}
                </Heading> */}
                <Heading level={3} margin='none'>
                    {this.props.name}
                </Heading>
            </Box>
        );
    }
}

export default HeaderModule;