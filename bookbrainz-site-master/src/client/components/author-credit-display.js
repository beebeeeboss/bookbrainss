/*
 * Copyright (C) 2020  Sean Burke
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

import PropTypes from 'prop-types';
import React from 'react';
import {map as _map} from 'lodash';


function AuthorCreditDisplay({names}) {
	const nameElements = _map(names, (name) => (
		<span key={`author-credit-${name.authorCreditID}-${name.position}`}>
			<a href={`/author/${name.authorBBID}`}>
				{name.name}
			</a>
			{name.joinPhrase}
		</span>
	));

	return (
		<span>
			{nameElements}
		</span>
	);
}

AuthorCreditDisplay.displayName = 'AuthorCreditDisplay';
AuthorCreditDisplay.propTypes = {
	names: PropTypes.oneOfType([
		PropTypes.array,
		PropTypes.object
	]).isRequired
};

export default AuthorCreditDisplay;
