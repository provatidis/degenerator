import { initLearnReturn } from './ui/learn-return.js?v=1.15.0';
import { initPositionPeriod } from './ui/position-period.js?v=1.15.0';
import { initWorkspaces } from './ui/workspaces.js?v=1.15.0';
import { initPositionFees } from './ui/position-fees.js?v=1.15.0';
import { initExamples } from './ui/examples.js?v=1.15.0';
import { initPageAccess } from './ui/page-access.js?v=1.15.0';
import { initPositionSnapshots } from './ui/positions.js?v=1.15.0';
import { initSnapshotNavigation } from './ui/snapshot-navigation.js?v=1.15.0';
import { initSandbox } from './ui/sandbox.js?v=1.15.0';
import { initLabNavigation } from './ui/lab-navigation.js?v=1.15.0';
import { initFullRangeLab } from './ui/full-range.js?v=1.15.0';
import { initRangeLab } from './ui/range.js?v=1.15.0';
import { initPoolSnapshots } from './ui/pools.js?v=1.15.0';
import { initSavedExperiments } from './ui/saved-experiments.js?v=1.15.0';

// Compose controllers explicitly. Data adapters and calculation models never initialize UI.
const pageAccess = initPageAccess();
const workspaces = initWorkspaces();
const navigation = initLabNavigation({ activate: () => { workspaces.select('experiment'); pageAccess.refreshOffsets(); } });
const snapshots = initSnapshotNavigation({ activate: () => workspaces.select('inspect') });
initSandbox();
const fullRangeLab = initFullRangeLab({ navigation });
const rangeLab = initRangeLab({ navigation });
initLearnReturn({ fullRangeLab, rangeLab, navigation });
initPoolSnapshots({ fullRangeLab, rangeLab });
const positionFees = initPositionFees();
const positionSnapshots = initPositionSnapshots({ rangeLab, positionFees });
snapshots.restoreLocation();
navigation.restoreLocation();
initExamples({
  positionSnapshots, snapshotNavigation: snapshots,
  restoreScenario: () => { fullRangeLab.restoreLocation(); rangeLab.restoreLocation(); navigation.restoreLocation(); },
});
initSavedExperiments({ fullRangeLab, rangeLab });
initPositionPeriod({ rangeLab });

workspaces.restoreLocation();
