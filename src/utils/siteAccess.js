/**
 * Shared helpers for employees that can be assigned to more than one site
 * (transferred employees / employees visible on all sites).
 */

// True if the given employee (plain object or mongoose doc) is allowed to be
// seen/operated on from siteId — either it's their home site, one of their
// extra assigned sites, or they're flagged as visible on every site.
export function employeeWorksAtSite(employee, siteId) {
  if (!employee || !siteId) return false;
  if (employee.allSites) return true;
  if (String(employee.site?._id || employee.site) === String(siteId)) return true;
  const extraSites = employee.sites || [];
  return extraSites.some((s) => String(s?._id || s) === String(siteId));
}

// Mongo filter fragment: matches any employee visible at siteId (home site,
// assigned extra site, or allSites=true).
export function siteVisibilityFilter(siteId) {
  return { $or: [{ site: siteId }, { sites: siteId }, { allSites: true }] };
}
