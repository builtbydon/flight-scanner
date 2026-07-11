"""pandora_components — the shared component library for the Pandora app fleet.

The canonical, versioned home for reusable **code components**. Each component
is versioned independently (see its module's ``__component_version__`` and the
repo-root ``components.json`` catalog manifest). Apps depend on this package and
declare what they consume in their own ``components.json`` so Pandora's Box can
build the catalog + drift matrix. See README.md and MANIFEST_SPEC.md.
"""

__version__ = "0.2.0"
