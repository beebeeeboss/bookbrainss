/*
 * Copyright (C) 2015       Ben Ockmore
 *               2015-2016  Sean Burke
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

import * as auth from '../../helpers/auth';
import * as entityRoutes from './entity';
import * as middleware from '../../helpers/middleware';
import * as search from '../../../common/helpers/search';
import * as utils from '../../helpers/utils';

import {
	entityEditorMarkup,
	generateEntityProps,
	makeEntityCreateOrEditHandler
} from '../../helpers/entityRouteUtils';

import {ConflictError} from '../../../common/helpers/error';
import _ from 'lodash';
import {escapeProps} from '../../helpers/props';
import express from 'express';
import log from 'log';
import target from '../../templates/target';

/** ****************************
*********** Helpers ************
*******************************/

function transformNewForm(data) {
	const aliases = entityRoutes.constructAliases(
		data.aliasEditor, data.nameSection
	);

	const identifiers = entityRoutes.constructIdentifiers(
		data.identifierEditor
	);

	const relationships = entityRoutes.constructRelationships(
		data.relationshipSection
	);

	let authorCredit = {};
	if (!_.isNil(data.authorCredit)) {
		// When merging entities, we use a separate reducer "authorCredit"
		authorCredit = data.authorCredit.names;
	}
	else if (!_.isNil(data.authorCreditEditor)) {
		authorCredit = entityRoutes.constructAuthorCredit(data.authorCreditEditor);
	}

	return {
		aliases,
		annotation: data.annotationSection.content,
		authorCredit,
		disambiguation: data.nameSection.disambiguation,
		identifiers,
		note: data.submissionSection.note,
		relationships,
		typeId: data.editionGroupSection.type
	};
}

const createOrEditHandler = makeEntityCreateOrEditHandler(
	'editionGroup', transformNewForm, 'typeId'
);

const mergeHandler = makeEntityCreateOrEditHandler(
	'editionGroup', transformNewForm, 'typeId', true
);


/** ****************************
*********** Routes ************
*******************************/

const router = express.Router();

// Creation
router.get(
	'/create', auth.isAuthenticated, middleware.loadIdentifierTypes,
	middleware.loadLanguages, middleware.loadEditionGroupTypes,
	middleware.loadRelationshipTypes, middleware.decodeUrlQueryParams,
	 async (req, res) => {
		const markupProps = generateEntityProps(
			'editionGroup', req, res, {}
		);
		const nameSection = {
			disambiguation: '',
			exactMatches: null,
			language: null,
			name: req.query?.name ?? '',
			searchResults: null,
			sortName: ''
		};
		if (nameSection.name) {
			try {
				nameSection.searchResults = await search.autocomplete(req.app.locals.orm, nameSection.name, 'EditionGroup');
				nameSection.exactMatches = await search.checkIfExists(req.app.locals.orm, nameSection.name, 'EditionGroup');
			}
			catch (err) {
				log.debug(err);
			}
		}

		markupProps.initialState.nameSection = nameSection;
		const {markup, props} = entityEditorMarkup(markupProps);

		return res.send(target({
			markup,
			props: escapeProps(props),
			script: '/js/entity-editor.js',
			title: props.heading
		}));
	}
);


router.post(
	'/create', entityRoutes.displayPreview, auth.isAuthenticatedForHandler, middleware.loadIdentifierTypes,
	middleware.loadLanguages, middleware.loadEditionGroupTypes,
	middleware.loadRelationshipTypes, async (req, res) => {
		const entity = await utils.parseInitialState(req, 'editionGroup');
		const {orm} = req.app.locals;
		const {EditionGroupType} = orm;
		if (entity.editionGroupSection?.type) {
			entity.editionGroupSection = {
				type: await utils.getIdByField(EditionGroupType, 'label', entity.editionGroupSection.type)
			};
		}
		const markupProps = generateEntityProps(
			'editionGroup', req, res, {}, () => entity
		);
		const {markup, props} = entityEditorMarkup(markupProps);

		return res.send(target({
			markup,
			props: escapeProps(props),
			script: '/js/entity-editor.js',
			title: props.heading
		}));
	}
);

router.post('/create/handler', auth.isAuthenticatedForHandler,
	createOrEditHandler);

/* If the route specifies a BBID, make sure it does not redirect to another bbid then load the corresponding entity */
router.param(
	'bbid',
	middleware.redirectedBbid
);
router.param(
	'bbid',
	middleware.makeEntityLoader(
		'EditionGroup',
		[
			'authorCredit.names.author.defaultAlias',
			'editionGroupType',
			'editions.defaultAlias',
			'editions.disambiguation',
			'editions.releaseEventSet.releaseEvents',
			'editions.identifierSet.identifiers.type',
			'editions.editionFormat'
		],
		'Edition Group not found'
	)
);

function _setEditionGroupTitle(res) {
	res.locals.title = utils.createEntityPageTitle(
		res.locals.entity,
		'EditionGroup',
		utils.template`Edition Group “${'name'}”`
	);
}

router.get('/:bbid', middleware.loadEntityRelationships, (req, res) => {
	_setEditionGroupTitle(res);
	res.locals.entity.editions.sort(entityRoutes.compareEntitiesByDate);
	entityRoutes.displayEntity(req, res);
});

router.get('/:bbid/delete', auth.isAuthenticated, (req, res, next) => {
	if (!res.locals.entity.dataId) {
		return next(new ConflictError('This entity has already been deleted'));
	}
	_setEditionGroupTitle(res);
	return entityRoutes.displayDeleteEntity(req, res);
});

router.post(
	'/:bbid/delete/handler', auth.isAuthenticatedForHandler,
	(req, res) => {
		const {orm} = req.app.locals;
		const {EditionGroupHeader, EditionGroupRevision} = orm;
		return entityRoutes.handleDelete(
			orm, req, res, EditionGroupHeader, EditionGroupRevision
		);
	}
);

router.get('/:bbid/revisions', (req, res, next) => {
	const {EditionGroupRevision} = req.app.locals.orm;
	_setEditionGroupTitle(res);
	entityRoutes.displayRevisions(req, res, next, EditionGroupRevision);
});

router.get('/:bbid/revisions/revisions', (req, res, next) => {
	const {EditionGroupRevision} = req.app.locals.orm;
	_setEditionGroupTitle(res);
	entityRoutes.updateDisplayedRevisions(req, res, next, EditionGroupRevision);
});


function editionGroupToFormState(editionGroup) {
	/** The front-end expects a language id rather than the language object. */
	const aliases = editionGroup.aliasSet ?
		editionGroup.aliasSet.aliases.map(({languageId, ...rest}) => ({
			...rest,
			language: languageId
		})) : [];

	const defaultAliasIndex = entityRoutes.getDefaultAliasIndex(editionGroup.aliasSet);
	const defaultAliasList = aliases.splice(defaultAliasIndex, 1);

	const aliasEditor = {};
	aliases.forEach((alias) => { aliasEditor[alias.id] = alias; });

	const buttonBar = {
		aliasEditorVisible: false,
		identifierEditorVisible: false
	};

	const nameSection = _.isEmpty(defaultAliasList) ? {
		language: null,
		name: '',
		sortName: ''
	} : defaultAliasList[0];
	nameSection.disambiguation =
		editionGroup.disambiguation && editionGroup.disambiguation.comment;

	const identifiers = editionGroup.identifierSet ?
		editionGroup.identifierSet.identifiers.map(({type, ...rest}) => ({
			type: type.id,
			...rest
		})) : [];

	const identifierEditor = {};
	identifiers.forEach(
		(identifier) => { identifierEditor[identifier.id] = identifier; }
	);

	const editionGroupSection = {
		type: editionGroup.editionGroupType && editionGroup.editionGroupType.id
	};

	const relationshipSection = {
		canEdit: true,
		lastRelationships: null,
		relationshipEditorProps: null,
		relationshipEditorVisible: false,
		relationships: {}
	};

	editionGroup.relationships.forEach((relationship) => (
		relationshipSection.relationships[`n${relationship.id}`] = {
			attributeSetId: relationship.attributeSetId,
			attributes: relationship.attributeSet ? relationship.attributeSet.relationshipAttributes : [],
			relationshipType: relationship.type,
			rowID: `n${relationship.id}`,
			sourceEntity: relationship.source,
			targetEntity: relationship.target
		}
	));

	const optionalSections = {};
	if (editionGroup.annotation) {
		optionalSections.annotationSection = editionGroup.annotation;
	}

	const credits = editionGroup.authorCredit ? editionGroup.authorCredit.names.map(
		({author, ...rest}) => ({
			author: utils.entityToOption(author),
			...rest
		})
	) : [];

	const authorCreditEditor = {};
	for (const credit of credits) {
		authorCreditEditor[credit.position] = credit;
	}
	if (_.isEmpty(authorCreditEditor)) {
		authorCreditEditor.n0 = {
			author: null,
			joinPhrase: '',
			name: ''
		};
	}

	return {
		aliasEditor,
		authorCreditEditor,
		buttonBar,
		editionGroupSection,
		identifierEditor,
		nameSection,
		relationshipSection,
		...optionalSections
	};
}

router.get(
	'/:bbid/edit', auth.isAuthenticated, middleware.loadIdentifierTypes,
	middleware.loadEditionGroupTypes, middleware.loadLanguages,
	 middleware.loadEntityRelationships, middleware.loadRelationshipTypes,
	(req, res) => {
		const {markup, props} = entityEditorMarkup(generateEntityProps(
			'editionGroup', req, res, {}, editionGroupToFormState
		));

		return res.send(target({
			markup,
			props: escapeProps(props),
			script: '/js/entity-editor.js',
			title: props.heading
		}));
	}
);

router.post('/:bbid/edit/handler', auth.isAuthenticatedForHandler,
	createOrEditHandler);

router.post('/:bbid/merge/handler', auth.isAuthenticatedForHandler,
	mergeHandler);

export default router;
