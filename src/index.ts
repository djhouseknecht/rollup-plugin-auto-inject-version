// import fs from 'fs';
// import path from 'path';
import { OutputBundle, Plugin, OutputChunk } from 'rollup';
import { merge } from 'lodash';
import { defaultConfig } from './config/config';
import { VIInjector } from './utils/injector';
import { VILogger } from './utils/logger';
import { VersionInjectorConfig } from './types/interfaces';

/**
 * Rollup.js plugin that will find and replace verion number and/or date in the source code
 * 	and add a comment at the top of a file with version number and/or date.
 * @param userConfig user configuration
 */
export default function versionInjector (userConfig?: Partial<VersionInjectorConfig>): Partial<Plugin> {
  const pluginName: string = 'version-injector';
  const config: VersionInjectorConfig = merge({}, defaultConfig, userConfig);
  const logger: VILogger = new VILogger(config.logLevel, config.logger);
  const injector: VIInjector = new VIInjector(logger);

  let version: string;

  return {
    name: pluginName,
    writeBundle(outputBundle: OutputBundle, bundle: any) {
      version = injector.getVersion(config.packageJson);
      logger.log(`${pluginName} started with version "${version}"`);
      logger.debug('config', config);
      const outputFiles = Object.keys(bundle);
      outputFiles.forEach((id) => {
        const chunk = bundle[id];
        const outputFile = chunk.fileName;
        /* skip if no file was output */
        if (!outputFile) {
          logger.warn('no fileName found - skipping', chunk);
          return;
        }

        logger.debug('output file', outputFile);

        /* skip if the filename is in the excludes list */
        const fileName = chunk.fileName;
        if (config.exclude.includes(fileName)) {
          logger.info('file was in the exclude list - skipping', fileName);
          return;
        }

        logger.debug('file name', fileName);
        /* skip if the output bundle doesn't exist or if it is an assest */
        const tmpBundle = chunk;
        if (!tmpBundle || tmpBundle.type === 'asset') {
          logger.info('output bundle did not exist or was an asset - skipping', fileName);
          return;
        }

        /* get the code from the bundle */
        let code = (tmpBundle as OutputChunk).code;

        injector.setCode(code);
        injector.injectIntoTags(config.injectInTags, fileName, version);
        injector.injectIntoComments(config.injectInComments, fileName, version);

        if (injector.isCodeChanged()) {
          injector.writeToFile(`${outputBundle.dir}/${outputFile}`);
        } else {
          logger.log(`file was not changed. did not write to file "${fileName}"`);
        }
      });
      logger.log(`${pluginName} finished`);
    }
  } as unknown as Partial<Plugin>;
}
