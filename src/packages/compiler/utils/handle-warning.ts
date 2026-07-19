/**
 * @private
 */
type CompilerWarning = {
  code: string;
  message: string;
};

/**
 * @private
 */
export default function handleWarning(warning: CompilerWarning): void {
  if (warning.code === 'UNUSED_EXTERNAL_IMPORT') {
    return;
  }
   
  console.warn(warning.message);
}
