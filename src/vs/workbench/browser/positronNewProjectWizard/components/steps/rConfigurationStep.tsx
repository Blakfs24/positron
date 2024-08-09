/*---------------------------------------------------------------------------------------------
 *  Copyright (C) 2024 Posit Software, PBC. All rights reserved.
 *  Licensed under the Elastic License 2.0. See LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/

// CSS.
import 'vs/css!./rConfigurationStep';

// React.
import * as React from 'react';
import { PropsWithChildren, useEffect, useState } from 'react';  // eslint-disable-line no-duplicate-imports

// Other dependencies.
import { useNewProjectWizardContext } from 'vs/workbench/browser/positronNewProjectWizard/newProjectWizardContext';
import { NewProjectWizardStepProps } from 'vs/workbench/browser/positronNewProjectWizard/interfaces/newProjectWizardStepProps';
import { localize } from 'vs/nls';
import { PositronWizardStep } from 'vs/workbench/browser/positronNewProjectWizard/components/wizardStep';
import { PositronWizardSubStep } from 'vs/workbench/browser/positronNewProjectWizard/components/wizardSubStep';
import { DropDownListBox } from 'vs/workbench/browser/positronComponents/dropDownListBox/dropDownListBox';
import { Checkbox } from 'vs/workbench/browser/positronComponents/positronModalDialog/components/checkbox';
import { InterpreterEntry } from 'vs/workbench/browser/positronNewProjectWizard/components/steps/interpreterEntry';
import { interpretersToDropdownItems } from 'vs/workbench/browser/positronNewProjectWizard/utilities/interpreterDropDownUtils';
import { ExternalLink } from 'vs/base/browser/ui/ExternalLink/ExternalLink';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { WizardFormattedText, WizardFormattedTextType } from 'vs/workbench/browser/positronNewProjectWizard/components/wizardFormattedText';

// NOTE: If you are making changes to this file, the equivalent Python component may benefit from
// similar changes. See src/vs/workbench/browser/positronNewProjectWizard/components/steps/pythonEnvironmentStep.tsx

/**
 * The RConfigurationStep component is specific to R projects in the new project wizard.
 * @param props The NewProjectWizardStepProps
 * @returns The rendered component
 */
export const RConfigurationStep = (props: PropsWithChildren<NewProjectWizardStepProps>) => {
	// State.
	const context = useNewProjectWizardContext();
	const {
		keybindingService,
		languageRuntimeService,
		layoutService,
		logService,
		openerService,
	} = context.services;

	// Hooks.
	const [interpreters, setInterpreters] = useState(context.interpreters);
	const [selectedInterpreter, setSelectedInterpreter] = useState(context.selectedRuntime);
	const [preferredInterpreter, setPreferredInterpreter] = useState(context.preferredInterpreter);
	const [minimumRVersion, setMinimumRVersion] = useState(context.minimumRVersion);

	useEffect(() => {
		// Create the disposable store for cleanup.
		const disposableStore = new DisposableStore();

		// Add the onUpdateInterpreterState event handler and update the component state.
		disposableStore.add(context.onUpdateInterpreterState(() => {
			setInterpreters(context.interpreters);
			setSelectedInterpreter(context.selectedRuntime);
			setPreferredInterpreter(context.preferredInterpreter);
			setMinimumRVersion(context.minimumRVersion);
		}));

		// Return the cleanup function that will dispose of the event handlers.
		return () => disposableStore.dispose();
	}, [context]);

	// Utility functions.
	const interpretersAvailable = () => Boolean(interpreters && interpreters.length);
	const interpretersLoading = () => !interpreters;

	// Handler for when the interpreter is selected.
	const onInterpreterSelected = (identifier: string) => {
		// Update the selected interpreter.
		const selectedRuntime = languageRuntimeService.getRegisteredRuntime(identifier);
		if (!selectedRuntime) {
			// This shouldn't happen, since the DropDownListBox should only allow selection of registered
			// runtimes
			logService.error(`No R runtime found for identifier: ${identifier}`);
			return;
		}
		context.selectedRuntime = selectedRuntime;
	};

	// Construct the interpreter dropdown title.
	const interpreterDropdownTitle = () => {
		// If interpreters is undefined, show a loading message.
		if (!interpreters) {
			return localize(
				'rConfigurationStep.versionSubStep.dropDown.title.loading',
				"Discovering R versions..."
			);
		}

		// If interpreters is empty, show a message that no interpreters were found.
		if (!interpretersAvailable()) {
			return localize(
				'rConfigurationStep.versionSubStep.dropDown.title.noInterpreters',
				"No interpreters found."
			);
		}

		// Otherwise, show the default title.
		return localize(
			'rConfigurationStep.versionSubStep.dropDown.title',
			"Select a version of R"
		);
	};

	// Render.
	return (
		<PositronWizardStep
			title={(() => localize(
				'rConfigurationStep.title',
				"Set up project configuration"
			))()}
			backButtonConfig={{ onClick: props.back }}
			cancelButtonConfig={{ onClick: props.cancel }}
			okButtonConfig={{
				onClick: props.accept,
				title: (() => localize(
					'positronNewProjectWizard.createButtonTitle',
					"Create"
				))(),
				disable: !selectedInterpreter
			}}
		>
			<PositronWizardSubStep
				title={(() =>
					localize(
						'rConfigurationStep.versionSubStep.title',
						'R Version'
					))()}
				description={(() =>
					localize(
						'rConfigurationStep.versionSubStep.description',
						'Select a version of R to launch your project with. You can modify this later if you change your mind.'
					))()}
				feedback={
					!interpretersLoading() && !interpretersAvailable() ? (
						<WizardFormattedText
							type={WizardFormattedTextType.Warning}
						>
							{(() =>
								localize(
									'rConfigurationStep.versionSubStep.feedback.noSuitableInterpreters',
									'No suitable interpreters found. Please install R version {0} or later.',
									minimumRVersion
								))()}
						</WizardFormattedText>
					) : undefined
				}
			>
				<DropDownListBox
					keybindingService={keybindingService}
					layoutService={layoutService}
					disabled={!interpretersAvailable()}
					title={interpreterDropdownTitle()}
					entries={
						interpretersAvailable()
							? interpretersToDropdownItems(
								interpreters!,
								preferredInterpreter?.runtimeId
							)
							: []
					}
					selectedIdentifier={selectedInterpreter?.runtimeId}
					createItem={(item) => (
						<InterpreterEntry
							interpreterInfo={item.options.value}
						/>
					)}
					onSelectionChanged={(item) =>
						onInterpreterSelected(item.options.identifier)
					}
				/>
			</PositronWizardSubStep>
			<PositronWizardSubStep
				title={(() =>
					localize(
						'rConfigurationStep.advancedConfigSubStep.title',
						"Advanced Configuration"
					))()}
			>
				<div className='renv-configuration'>
					<Checkbox
						label={(() =>
							localize(
								'rConfigurationStep.additionalConfigSubStep.useRenv.label',
								"Use `renv` to create a reproducible environment"
							))()}
						onChanged={(checked) => (context.useRenv = checked)}
						initialChecked={context.useRenv}
					/>
					<ExternalLink
						className='renv-docs-external-link'
						openerService={openerService}
						href='https://rstudio.github.io/renv/articles/renv.html'
						title='https://rstudio.github.io/renv/articles/renv.html'
					>
						<div className='codicon codicon-link-external' />
					</ExternalLink>
				</div>
			</PositronWizardSubStep>
		</PositronWizardStep>
	);
};