import { parse } from 'jsr:@std/semver';

export default parse(process.env.NPM_PACKAGE_VERSION ?? '0.0.0-development');
