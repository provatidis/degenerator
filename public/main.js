import { initSandbox } from './ui/sandbox.js';
import { initLabNavigation } from './ui/lab-navigation.js';
import { initFullRangeLab } from './ui/full-range.js';
import { initRangeLab } from './ui/range.js';
import { initPoolSnapshots } from './ui/pools.js';

// Compose controllers explicitly. Data adapters and calculation models never initialize UI.
const navigation = initLabNavigation();
initSandbox();
const fullRangeLab = initFullRangeLab({ navigation });
const rangeLab = initRangeLab({ navigation });
initPoolSnapshots({ fullRangeLab, rangeLab });
navigation.restoreLocation();
