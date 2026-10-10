import { initPositionSnapshots } from './ui/positions.js';
import { initSnapshotNavigation } from './ui/snapshot-navigation.js';
import { initSandbox } from './ui/sandbox.js';
import { initLabNavigation } from './ui/lab-navigation.js';
import { initFullRangeLab } from './ui/full-range.js';
import { initRangeLab } from './ui/range.js';
import { initPoolSnapshots } from './ui/pools.js';

// Compose controllers explicitly. Data adapters and calculation models never initialize UI.
const navigation = initLabNavigation();
const snapshots = initSnapshotNavigation();
initSandbox();
const fullRangeLab = initFullRangeLab({ navigation });
const rangeLab = initRangeLab({ navigation });
initPoolSnapshots({ fullRangeLab, rangeLab });
initPositionSnapshots({ rangeLab });
snapshots.restoreLocation();
navigation.restoreLocation();
