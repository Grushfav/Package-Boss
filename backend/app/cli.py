import click
from flask.cli import with_appcontext

from app.services.clear_test_data_service import clear_test_data, preview_clear_test_data
from app.services.unidentified_service import ensure_unidentified_holder


def register_cli(app) -> None:
    app.cli.add_command(clear_test_data_command)


@click.command("clear-test-data")
@click.option(
    "--yes",
    is_flag=True,
    help="Skip confirmation prompt and delete data.",
)
@click.option(
    "--keep-announcements",
    is_flag=True,
    help="Keep announcements and broadcast history.",
)
@with_appcontext
def clear_test_data_command(yes: bool, keep_announcements: bool) -> None:
    """Remove packages, payments, customer requests, and test customer accounts."""
    preview = preview_clear_test_data()
    click.echo("Will delete:")
    for key, count in preview.items():
        if key == "staff_accounts_kept":
            click.echo(f"  keep {key}: {count}")
        elif count:
            click.echo(f"  {key}: {count}")

    operational = sum(
        count for key, count in preview.items() if key not in ("staff_accounts_kept",)
    )
    if operational == 0:
        click.echo("Nothing to delete.")
        return

    if not yes and not click.confirm("Delete all listed test/operational data?", default=False):
        click.echo("Cancelled.")
        return

    summary = clear_test_data(include_announcements=not keep_announcements)
    ensure_unidentified_holder()
    click.echo("Deleted:")
    for key, count in summary.counts.items():
        if count:
            click.echo(f"  {key}: {count}")
    click.echo("Done. Admin/clerk accounts and rate tiers were kept.")
