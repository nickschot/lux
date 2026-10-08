import UnknownAttributeError from '../../../errors/unknown-attribute-error';
import type Controller from '../../controller';
import type Serializer from '../../serializer';
import type { Model, ModelClass } from '../../database';
import type { Bundle$Namespace } from '../../loader';

const columnsOf = (model: ModelClass) =>
  `${model.name} (table \`${model.tableName}\`)`;

/**
 * Check that every serializer's `attributes`, and every controller's `sort`
 * and `filter`, name columns of their model. Anything else used to be
 * accepted and then silently ignored: missing from responses, and a `sort`
 * or `filter` that did nothing. Throws listing every problem.
 *
 * A controller's `sort` and `filter` default to its serializer's
 * `attributes`, so only names its serializer does not list are reported for
 * the controller.
 *
 * @internal
 */
export default function validateAttributes(
  controllers: Bundle$Namespace<Controller> | Map<string, Controller>,
  serializers:
    Bundle$Namespace<Serializer<Model>> | Map<string, Serializer<Model>>
): void {
  const problems: Array<string> = [];

  serializers.forEach((serializer, key) => {
    const { model, attributes } = serializer;

    if (!model) {
      return;
    }

    attributes
      .filter(name => !model.attributeNames.includes(name))
      .forEach(name => {
        problems.push(
          `serializers/${key}: \`attributes\` lists \`${name}\`, which is ` +
            `not a column of ${columnsOf(model)}`
        );
      });
  });

  controllers.forEach((controller, key) => {
    const { model, serializer } = controller;

    if (!model) {
      return;
    }

    (['sort', 'filter'] as const).forEach(setting => {
      controller[setting]
        .filter(
          name =>
            !model.attributeNames.includes(name) &&
            !serializer?.attributes.includes(name)
        )
        .forEach(name => {
          problems.push(
            `controllers/${key}: \`${setting}\` lists \`${name}\`, which is ` +
              `not a column of ${columnsOf(model)}`
          );
        });
    });
  });

  if (problems.length) {
    throw new UnknownAttributeError(problems);
  }
}
