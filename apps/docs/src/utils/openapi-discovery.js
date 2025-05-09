/**
 * Utility for discovering and loading OpenAPI specs from the public/openapi directory
 */

/**
 * Discovers all available OpenAPI specs in the public/openapi directory
 * @returns {Promise<Array<{url: string, title: string}>>} Array of OpenAPI spec sources
 */
export async function discoverOpenApiSpecs() {
  try {
    // Fetch the list of available specs from the server
    const response = await fetch('/openapi/index.json');
    
    if (response.ok) {
      // If the index.json exists, use it to get the list of specs
      const specs = await response.json();
      return specs;
    } else {
      // Fallback: try to discover specs by checking for common filenames
      const possibleSpecs = [
        { url: '/openapi/cyclist-profile.json', title: 'Cyclist Profile API' }
      ];
      
      // Check which specs actually exist
      const availableSpecs = await Promise.all(
        possibleSpecs.map(async (spec) => {
          try {
            const checkResponse = await fetch(spec.url, { method: 'HEAD' });
            return checkResponse.ok ? spec : null;
          } catch (error) {
            console.warn(`Failed to check spec ${spec.url}:`, error);
            return null;
          }
        })
      );
      
      return availableSpecs.filter(Boolean);
    }
  } catch (error) {
    console.error('Error discovering OpenAPI specs:', error);
    return [];
  }
}

/**
 * Formats an API name from a filename
 * @param {string} filename - The filename of the OpenAPI spec
 * @returns {string} A formatted API name
 */
export function formatApiName(filename) {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.(json|yaml|yml)$/, '');
  
  // Convert kebab-case to Title Case
  return nameWithoutExt
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') + ' API';
}
