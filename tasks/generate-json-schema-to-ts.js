// @ts-check
const { compile } = require('json-schema-to-typescript');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const resolveFromParent = path.resolve.bind(path, __dirname, '..');
const globAsPromised = promisify(glob);

/**
 * 
 * @param {string} schemaFile 
 */
async function generate(schemaFile) {
  const parsedFile = path.parse(schemaFile);
  const schema = preprocessSchema(require(schemaFile));
  const resolveOutputDir = path.resolve.bind(path, parsedFile.dir, '..', 'src-generated');
  const outFile = resolveOutputDir(`${parsedFile.name}.ts`);
  await mkdir(resolveOutputDir(), { recursive: true });
  let ts = (await compile(schema, parsedFile.base, {
    style: {
      singleQuote: true,
    },
    $refOptions: {
      resolve: {
        http: false // We're not interesting in generating exact babel / tsconfig / etc types
      }
    },
    bannerComment: `/**
    * This file was automatically generated by ${path.basename(__filename)}.
    * DO NOT MODIFY IT BY HAND. Instead, modify the source file JSON file: ${path.basename(schemaFile)},
    * and run 'npm run generate' from monorepo base directory.
    */`
  }));
  await writeFile(outFile, ts, 'utf8');
  console.info(`✅ ${path.relative(path.resolve(__dirname, '..'), path.resolve(__dirname, schemaFile))} -> ${path.relative(path.resolve(__dirname, '..'), resolveFromParent(outFile))}`);
}

async function generateAllSchemas() {
  const files = await globAsPromised('packages/!(core)/schema/*.json', { cwd: resolveFromParent() });
  await Promise.all(files.map(fileName => generate(resolveFromParent(fileName))));
}
generateAllSchemas().catch(err => {
  console.error('TS generation failed', err);
  process.exitCode = 1;
});

function preprocessSchema(inputSchema) {
  const cleanedSchema = cleanExternalRef(inputSchema);

  try {
    switch (cleanedSchema.type) {
      case 'object':
        const inputRequired = cleanedSchema.required || [];
        const outputSchema = {
          ...cleanedSchema,
          properties: preprocessProperties(cleanedSchema.properties),
          definitions: preprocessProperties(cleanedSchema.definitions),
          required: preprocessRequired(cleanedSchema.properties, inputRequired)
        }
        if (cleanedSchema.definitions) {
          outputSchema.definitions = preprocessProperties(cleanedSchema.definitions);
        }
        return outputSchema;
      case 'array':
        return {
          ...cleanedSchema,
          items: preprocessSchema(cleanedSchema.items)
        }
      default:
        if (cleanedSchema.$ref) {
          // Workaround for: https://github.com/bcherny/json-schema-to-typescript/issues/193
          return {
            $ref: cleanedSchema.$ref
          }
        }
        if(cleanedSchema.oneOf) {
          return {
            ...cleanedSchema,
            oneOf: cleanedSchema.oneOf.map(preprocessSchema)
          }
        }
        return cleanedSchema;
    }
  } catch (err) {
    if (err instanceof SchemaError) {
      throw err
    } else {
      throw new SchemaError(`Schema failed: ${JSON.stringify(inputSchema)}, ${err.stack}`);
    }
  }
}

class SchemaError extends Error { }

function preprocessProperties(inputProperties) {
  if (inputProperties) {
    const outputProperties = {};
    Object.entries(inputProperties).forEach(([name, value]) => outputProperties[name] = preprocessSchema(value));
    return outputProperties;
  }
}

function cleanExternalRef(inputSchema) {
  if(inputSchema.$ref && inputSchema.$ref.startsWith('http')) {
    return {
      ...inputSchema,
      $ref: undefined
    }
  }
  return inputSchema;
}

function preprocessRequired(inputProperties, inputRequired) {
  if (inputProperties) {
    return Object.entries(inputProperties)
      .filter(([name, value]) => 'default' in value || inputRequired.indexOf(name) >= 0)
      .map(([name]) => name)
  } else {
    return inputRequired;
  }
}
