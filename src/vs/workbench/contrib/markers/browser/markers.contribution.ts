/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/workbench/contrib/markers/browser/markersFileDecorations';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { Extensions, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { Categories } from 'vs/platform/action/common/actionCommonCategories';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { localize, localize2 } from 'vs/nls';
import { Marker, RelatedInformation, ResourceMarkers } from 'vs/workbench/contrib/markers/browser/markersModel';
import { MarkersView } from 'vs/workbench/contrib/markers/browser/markersView';
import { MenuId, registerAction2, Action2 } from 'vs/platform/actions/common/actions';
import { Registry } from 'vs/platform/registry/common/platform';
import { MarkersViewMode, Markers, MarkersContextKeys } from 'vs/workbench/contrib/markers/common/markers';
import Messages from 'vs/workbench/contrib/markers/browser/messages';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IMarkersView } from 'vs/workbench/contrib/markers/browser/markers';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { Disposable, IDisposable, MutableDisposable } from 'vs/base/common/lifecycle';
import { IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment, IStatusbarEntry } from 'vs/workbench/services/statusbar/browser/statusbar';
import { IMarkerService, MarkerStatistics } from 'vs/platform/markers/common/markers';
import { ViewContainer, IViewContainersRegistry, Extensions as ViewContainerExtensions, ViewContainerLocation, IViewsRegistry } from 'vs/workbench/common/views';
import { IViewsService } from 'vs/workbench/services/views/common/viewsService';
import { getVisbileViewContextKey, FocusedViewContext } from 'vs/workbench/common/contextkeys';
import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Codicon } from 'vs/base/common/codicons';
import { registerIcon } from 'vs/platform/theme/common/iconRegistry';
import { ViewAction } from 'vs/workbench/browser/parts/views/viewPane';
import { IActivityService, NumberBadge } from 'vs/workbench/services/activity/common/activity';
import { viewFilterSubmenu } from 'vs/workbench/browser/parts/views/viewFilter';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { problemsConfigurationNodeBase } from 'vs/workbench/common/configuration';

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: Markers.MARKER_OPEN_ACTION_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: ContextKeyExpr.and(MarkersContextKeys.MarkerFocusContextKey),
	primary: KeyCode.Enter,
	mac: {
		primary: KeyCode.Enter,
		secondary: [KeyMod.CtrlCmd | KeyCode.DownArrow]
	},
	handler: (accessor, args: any) => {
		const markersView = accessor.get(IViewsService).getActiveViewWithId<MarkersView>(Markers.MARKERS_VIEW_ID)!;
		markersView.openFileAtElement(markersView.getFocusElement(), false, false, true);
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: Markers.MARKER_OPEN_SIDE_ACTION_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: ContextKeyExpr.and(MarkersContextKeys.MarkerFocusContextKey),
	primary: KeyMod.CtrlCmd | KeyCode.Enter,
	mac: {
		primary: KeyMod.WinCtrl | KeyCode.Enter
	},
	handler: (accessor, args: any) => {
		const markersView = accessor.get(IViewsService).getActiveViewWithId<MarkersView>(Markers.MARKERS_VIEW_ID)!;
		markersView.openFileAtElement(markersView.getFocusElement(), false, true, true);
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: Markers.MARKER_SHOW_PANEL_ID,
	weight: KeybindingWeight.WorkbenchContrib,
	when: undefined,
	primary: undefined,
	handler: async (accessor, args: any) => {
		await accessor.get(IViewsService).openView(Markers.MARKERS_VIEW_ID);
	}
});

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: Markers.MARKER_SHOW_QUICK_FIX,
	weight: KeybindingWeight.WorkbenchContrib,
	when: MarkersContextKeys.MarkerFocusContextKey,
	primary: KeyMod.CtrlCmd | KeyCode.Period,
	handler: (accessor, args: any) => {
		const markersView = accessor.get(IViewsService).getActiveViewWithId<MarkersView>(Markers.MARKERS_VIEW_ID)!;
		const focusedElement = markersView.getFocusElement();
		if (focusedElement instanceof Marker) {
			markersView.showQuickFixes(focusedElement);
		}
	}
});

// configuration
Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
	...problemsConfigurationNodeBase,
	'properties': {
		'problems.autoReveal': {
			'description': Messages.PROBLEMS_PANEL_CONFIGURATION_AUTO_REVEAL,
			'type': 'boolean',
			'default': true
		},
		'problems.defaultViewMode': {
			'description': Messages.PROBLEMS_PANEL_CONFIGURATION_VIEW_MODE,
			'type': 'string',
			'default': 'tree',
			'enum': ['table', 'tree'],
		},
		'problems.showCurrentInStatus': {
			'description': Messages.PROBLEMS_PANEL_CONFIGURATION_SHOW_CURRENT_STATUS,
			'type': 'boolean',
			'default': false
		},
		'problems.sortOrder': {
			'description': Messages.PROBLEMS_PANEL_CONFIGURATION_COMPARE_ORDER,
			'type': 'string',
			'default': 'severity',
			'enum': ['severity', 'position'],
			'enumDescriptions': [
				Messages.PROBLEMS_PANEL_CONFIGURATION_COMPARE_ORDER_SEVERITY,
				Messages.PROBLEMS_PANEL_CONFIGURATION_COMPARE_ORDER_POSITION,
			],
		},
	}
});

const markersViewIcon = registerIcon('markers-view-icon', Codicon.warning, localize('markersViewIcon', 'View icon of the markers view.'));

// markers view container
const VIEW_CONTAINER: ViewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: Markers.MARKERS_CONTAINER_ID,
	title: Messages.MARKERS_PANEL_TITLE_PROBLEMS,
	icon: markersViewIcon,
	hideIfEmpty: true,
	// --- Start Positron ---
	order: 3,
	// --- End Positron ---
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [Markers.MARKERS_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: Markers.MARKERS_VIEW_STORAGE_ID,
}, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: true });

Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([{
	id: Markers.MARKERS_VIEW_ID,
	containerIcon: markersViewIcon,
	name: Messages.MARKERS_PANEL_TITLE_PROBLEMS,
	canToggleVisibility: false,
	canMoveView: true,
	ctorDescriptor: new SyncDescriptor(MarkersView),
	openCommandActionDescriptor: {
		id: 'workbench.actions.view.problems',
		mnemonicTitle: localize({ key: 'miMarker', comment: ['&& denotes a mnemonic'] }, "&&Problems"),
		keybindings: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyM },
		order: 0,
	}
}], VIEW_CONTAINER);

// workbench
const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);

// actions
registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.table.${Markers.MARKERS_VIEW_ID}.viewAsTree`,
			title: localize('viewAsTree', "View as Tree"),
			menu: {
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID), MarkersContextKeys.MarkersViewModeContextKey.isEqualTo(MarkersViewMode.Table)),
				group: 'navigation',
				order: 3
			},
			icon: Codicon.listTree,
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.setViewMode(MarkersViewMode.Tree);
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.table.${Markers.MARKERS_VIEW_ID}.viewAsTable`,
			title: localize('viewAsTable', "View as Table"),
			menu: {
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID), MarkersContextKeys.MarkersViewModeContextKey.isEqualTo(MarkersViewMode.Tree)),
				group: 'navigation',
				order: 3
			},
			icon: Codicon.listFlat,
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.setViewMode(MarkersViewMode.Table);
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleErrors`,
			title: localize('show errors', "Show Errors"),
			category: localize('problems', "Problems"),
			toggled: MarkersContextKeys.ShowErrorsFilterContextKey,
			menu: {
				id: viewFilterSubmenu,
				group: '1_filter',
				when: ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID),
				order: 1
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.filters.showErrors = !view.filters.showErrors;
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleWarnings`,
			title: localize('show warnings', "Show Warnings"),
			category: localize('problems', "Problems"),
			toggled: MarkersContextKeys.ShowWarningsFilterContextKey,
			menu: {
				id: viewFilterSubmenu,
				group: '1_filter',
				when: ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID),
				order: 2
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.filters.showWarnings = !view.filters.showWarnings;
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleInfos`,
			title: localize('show infos', "Show Infos"),
			category: localize('problems', "Problems"),
			toggled: MarkersContextKeys.ShowInfoFilterContextKey,
			menu: {
				id: viewFilterSubmenu,
				group: '1_filter',
				when: ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID),
				order: 3
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.filters.showInfos = !view.filters.showInfos;
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleActiveFile`,
			title: localize('show active file', "Show Active File Only"),
			category: localize('problems', "Problems"),
			toggled: MarkersContextKeys.ShowActiveFileFilterContextKey,
			menu: {
				id: viewFilterSubmenu,
				group: '2_filter',
				when: ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID),
				order: 1
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.filters.activeFile = !view.filters.activeFile;
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.${Markers.MARKERS_VIEW_ID}.toggleExcludedFiles`,
			title: localize('show excluded files', "Show Excluded Files"),
			category: localize('problems', "Problems"),
			toggled: MarkersContextKeys.ShowExcludedFilesFilterContextKey.negate(),
			menu: {
				id: viewFilterSubmenu,
				group: '2_filter',
				when: ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID),
				order: 2
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}

	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		view.filters.excludedFiles = !view.filters.excludedFiles;
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.problems.focus',
			title: Messages.MARKERS_PANEL_SHOW_LABEL,
			category: Categories.View,
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		accessor.get(IViewsService).openView(Markers.MARKERS_VIEW_ID, true);
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		const when = ContextKeyExpr.and(FocusedViewContext.isEqualTo(Markers.MARKERS_VIEW_ID), MarkersContextKeys.MarkersTreeVisibilityContextKey, MarkersContextKeys.RelatedInformationFocusContextKey.toNegated());
		super({
			id: Markers.MARKER_COPY_ACTION_ID,
			title: localize2('copyMarker', 'Copy'),
			menu: {
				id: MenuId.ProblemsPanelContext,
				when,
				group: 'navigation'
			},
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyC,
				when
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		const clipboardService = serviceAccessor.get(IClipboardService);
		const selection = markersView.getFocusedSelectedElements() || markersView.getAllResourceMarkers();
		const markers: Marker[] = [];
		const addMarker = (marker: Marker) => {
			if (!markers.includes(marker)) {
				markers.push(marker);
			}
		};
		for (const selected of selection) {
			if (selected instanceof ResourceMarkers) {
				selected.markers.forEach(addMarker);
			} else if (selected instanceof Marker) {
				addMarker(selected);
			}
		}
		if (markers.length) {
			await clipboardService.writeText(`[${markers}]`);
		}
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.MARKER_COPY_MESSAGE_ACTION_ID,
			title: localize2('copyMessage', 'Copy Message'),
			menu: {
				id: MenuId.ProblemsPanelContext,
				when: MarkersContextKeys.MarkerFocusContextKey,
				group: 'navigation'
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		const clipboardService = serviceAccessor.get(IClipboardService);
		const element = markersView.getFocusElement();
		if (element instanceof Marker) {
			await clipboardService.writeText(element.marker.message);
		}
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.RELATED_INFORMATION_COPY_MESSAGE_ACTION_ID,
			title: localize2('copyMessage', 'Copy Message'),
			menu: {
				id: MenuId.ProblemsPanelContext,
				when: MarkersContextKeys.RelatedInformationFocusContextKey,
				group: 'navigation'
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		const clipboardService = serviceAccessor.get(IClipboardService);
		const element = markersView.getFocusElement();
		if (element instanceof RelatedInformation) {
			await clipboardService.writeText(element.raw.message);
		}
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.FOCUS_PROBLEMS_FROM_FILTER,
			title: localize('focusProblemsList', "Focus problems view"),
			keybinding: {
				when: MarkersContextKeys.MarkerViewFilterFocusContextKey,
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.DownArrow
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		markersView.focus();
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.MARKERS_VIEW_FOCUS_FILTER,
			title: localize('focusProblemsFilter', "Focus problems filter"),
			keybinding: {
				when: FocusedViewContext.isEqualTo(Markers.MARKERS_VIEW_ID),
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyF
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		markersView.focusFilter();
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.MARKERS_VIEW_SHOW_MULTILINE_MESSAGE,
			title: localize2('show multiline', "Show message in multiple lines"),
			category: localize('problems', "Problems"),
			menu: {
				id: MenuId.CommandPalette,
				when: ContextKeyExpr.has(getVisbileViewContextKey(Markers.MARKERS_VIEW_ID))
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		markersView.setMultiline(true);
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.MARKERS_VIEW_SHOW_SINGLELINE_MESSAGE,
			title: localize2('show singleline', "Show message in single line"),
			category: localize('problems', "Problems"),
			menu: {
				id: MenuId.CommandPalette,
				when: ContextKeyExpr.has(getVisbileViewContextKey(Markers.MARKERS_VIEW_ID))
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		markersView.setMultiline(false);
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: Markers.MARKERS_VIEW_CLEAR_FILTER_TEXT,
			title: localize('clearFiltersText', "Clear filters text"),
			category: localize('problems', "Problems"),
			keybinding: {
				when: MarkersContextKeys.MarkerViewFilterFocusContextKey,
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyCode.Escape
			},
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, markersView: IMarkersView): Promise<void> {
		markersView.clearFilterText();
	}
});

registerAction2(class extends ViewAction<IMarkersView> {
	constructor() {
		super({
			id: `workbench.actions.treeView.${Markers.MARKERS_VIEW_ID}.collapseAll`,
			title: localize('collapseAll', "Collapse All"),
			menu: {
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.and(ContextKeyExpr.equals('view', Markers.MARKERS_VIEW_ID), MarkersContextKeys.MarkersViewModeContextKey.isEqualTo(MarkersViewMode.Tree)),
				group: 'navigation',
				order: 2,
			},
			icon: Codicon.collapseAll,
			viewId: Markers.MARKERS_VIEW_ID
		});
	}
	async runInView(serviceAccessor: ServicesAccessor, view: IMarkersView): Promise<void> {
		return view.collapseAll();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: Markers.TOGGLE_MARKERS_VIEW_ACTION_ID,
			title: Messages.MARKERS_PANEL_TOGGLE_LABEL,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		if (viewsService.isViewVisible(Markers.MARKERS_VIEW_ID)) {
			viewsService.closeView(Markers.MARKERS_VIEW_ID);
		} else {
			viewsService.openView(Markers.MARKERS_VIEW_ID, true);
		}
	}
});

class MarkersStatusBarContributions extends Disposable implements IWorkbenchContribution {

	private markersStatusItem: IStatusbarEntryAccessor;
	private markersStatusItemOff: IStatusbarEntryAccessor | undefined;

	constructor(
		@IMarkerService private readonly markerService: IMarkerService,
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();
		this.markersStatusItem = this._register(this.statusbarService.addEntry(this.getMarkersItem(), 'status.problems', StatusbarAlignment.LEFT, 50 /* Medium Priority */));

		const addStatusBarEntry = () => {
			this.markersStatusItemOff = this.statusbarService.addEntry(this.getMarkersItemTurnedOff(), 'status.problemsVisibility', StatusbarAlignment.LEFT, 49);
		};

		// Add the status bar entry if the problems is not visible
		let config = this.configurationService.getValue('problems.visibility');
		if (!config) {
			addStatusBarEntry();
		}

		this._register(this.markerService.onMarkerChanged(() => {
			this.markersStatusItem.update(this.getMarkersItem());
		}));

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('problems.visibility')) {
				this.markersStatusItem.update(this.getMarkersItem());

				// Update based on what setting was changed to.
				config = this.configurationService.getValue('problems.visibility');
				if (!config && !this.markersStatusItemOff) {
					addStatusBarEntry();
				} else if (config && this.markersStatusItemOff) {
					this.markersStatusItemOff.dispose();
					this.markersStatusItemOff = undefined;
				}
			}
		}));
	}

	private getMarkersItem(): IStatusbarEntry {
		const markersStatistics = this.markerService.getStatistics();
		const tooltip = this.getMarkersTooltip(markersStatistics);
		return {
			name: localize('status.problems', "Problems"),
			text: this.getMarkersText(markersStatistics),
			ariaLabel: tooltip,
			tooltip,
			command: 'workbench.actions.view.toggleProblems'
		};
	}

	private getMarkersItemTurnedOff(): IStatusbarEntry {
		// Update to true, config checked before `getMarkersItemTurnedOff` is called.
		this.statusbarService.updateEntryVisibility('status.problemsVisibility', true);
		const openSettingsCommand = 'workbench.action.openSettings';
		const configureSettingsLabel = '@id:problems.visibility';
		const tooltip = localize('status.problemsVisibilityOff', "Problems are turned off. Click to open settings.");
		return {
			name: localize('status.problemsVisibility', "Problems Visibility"),
			text: '$(whole-word)',
			ariaLabel: tooltip,
			tooltip,
			kind: 'warning',
			command: { title: openSettingsCommand, arguments: [configureSettingsLabel], id: openSettingsCommand }
		};
	}

	private getMarkersTooltip(stats: MarkerStatistics): string {
		const errorTitle = (n: number) => localize('totalErrors', "Errors: {0}", n);
		const warningTitle = (n: number) => localize('totalWarnings', "Warnings: {0}", n);
		const infoTitle = (n: number) => localize('totalInfos', "Infos: {0}", n);

		const titles: string[] = [];

		if (stats.errors > 0) {
			titles.push(errorTitle(stats.errors));
		}

		if (stats.warnings > 0) {
			titles.push(warningTitle(stats.warnings));
		}

		if (stats.infos > 0) {
			titles.push(infoTitle(stats.infos));
		}

		if (titles.length === 0) {
			return localize('noProblems', "No Problems");
		}

		return titles.join(', ');
	}

	private getMarkersText(stats: MarkerStatistics): string {
		const problemsText: string[] = [];

		// Errors
		problemsText.push('$(error) ' + this.packNumber(stats.errors));

		// Warnings
		problemsText.push('$(warning) ' + this.packNumber(stats.warnings));

		// Info (only if any)
		if (stats.infos > 0) {
			problemsText.push('$(info) ' + this.packNumber(stats.infos));
		}

		return problemsText.join(' ');
	}

	private packNumber(n: number): string {
		const manyProblems = localize('manyProblems', "10K+");
		return n > 9999 ? manyProblems : n > 999 ? n.toString().charAt(0) + 'K' : n.toString();
	}
}

workbenchRegistry.registerWorkbenchContribution(MarkersStatusBarContributions, LifecyclePhase.Restored);

class ActivityUpdater extends Disposable implements IWorkbenchContribution {

	private readonly activity = this._register(new MutableDisposable<IDisposable>());

	constructor(
		@IActivityService private readonly activityService: IActivityService,
		@IMarkerService private readonly markerService: IMarkerService
	) {
		super();
		this._register(this.markerService.onMarkerChanged(() => this.updateBadge()));
		this.updateBadge();
	}

	private updateBadge(): void {
		const { errors, warnings, infos } = this.markerService.getStatistics();
		const total = errors + warnings + infos;
		if (total > 0) {
			const message = localize('totalProblems', 'Total {0} Problems', total);
			this.activity.value = this.activityService.showViewActivity(Markers.MARKERS_VIEW_ID, { badge: new NumberBadge(total, () => message) });
		} else {
			this.activity.value = undefined;
		}
	}
}

workbenchRegistry.registerWorkbenchContribution(ActivityUpdater, LifecyclePhase.Restored);
