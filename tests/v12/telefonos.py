"""Ejecutar desde la raíz. Prueba navegadores reales con perfiles móviles emulados."""
import json
import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

def upload(page, content):
    page.locator("#notice").evaluate("(n) => { n.textContent = '' }")
    page.locator("#file").set_input_files({
        "name": "presupuesto.json", "mimeType": "application/json", "buffer": content.encode()
    })

def import_ok(page, content):
    upload(page, content)
    expect(page.locator("#notice")).to_contain_text("Archivo verificado")

def export(page):
    with page.expect_download() as result:
        page.get_by_role("link", name="Exportar archivo").click()
    return Path(result.value.path()).read_text()

def save(page, number):
    page.locator("#save").click()
    expect(page.locator("#notice")).to_contain_text(f"V{number} firmada")
    expect(page.locator("#editor")).to_be_hidden()

def edit(page, labor):
    page.get_by_role("button", name="Proponer cambios", exact=True).click()
    page.locator(".price").last.fill(str(labor))
    save(page, 2)

def current(page):
    return page.locator("#sheet > article")

def capture(page, name):
    directory = os.getenv("V12_EVIDENCE_DIR")
    if directory:
        path = Path(directory)
        path.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=path / name, full_page=True)

def classic_receipt(page):
    page.locator("#bCrear").click()
    page.locator("#bTipoVenta").click()
    page.locator("#fCrear button[type=submit]").click()
    expect(page.locator("#cArchivo")).to_be_visible()
    with page.expect_download() as result:
        page.locator("#cArchivo").click()
    data = Path(result.value.path()).read_bytes()
    page.locator("#atras").click()
    page.locator("#bVerificar").click()
    page.locator("#vArchivo").set_input_files({"name": "venta.phenom", "mimeType": "text/plain", "buffer": data})
    expect(page.locator("#rBig")).to_contain_text("Verificado")
    page.locator("#rInicio").click()
    page.locator("#bOffline").click()
    page.locator("#fOffline button[type=submit]").click()
    expect(page.locator("#offMsg")).to_contain_text("guardada")
    page.reload()
    expect(page.locator("#bCrear")).to_be_visible()
    op = page.evaluate("compRespaldo.ops()[0]")
    assert op["estado"] == "PENDIENTE_NO_COBRADO" and op["sello"]["fp"] == page.evaluate("compRespaldo.yo()")
    print("PASS comprobante clásico firmado y verificado, y registro pendiente persistente", flush=True)

def main():
    with sync_playwright() as p:
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=ROOT))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f"http://127.0.0.1:{server.server_port}/comprobante-respaldo/"
        browsers = {}
        contexts = []
        offline = False
        try:
            for slot, (engine, device) in enumerate([("webkit", "iPhone 13"), ("webkit", "iPhone 13"), ("chromium", "Pixel 7")]):
                actual = os.getenv("V12_SINGLE_ENGINE", engine)
                opts = {}
                if actual == "chromium" and os.getenv("CHROMIUM_PATH"):
                    opts["executable_path"] = os.environ["CHROMIUM_PATH"]
                if actual not in browsers:
                    browsers[actual] = getattr(p, actual).launch(**opts)
                    print("Motor:", actual, browsers[actual].version, flush=True)
                settings = dict(p.devices[device])
                settings.pop("default_browser_type", None)
                ctx = browsers[actual].new_context(**settings, accept_downloads=True)
                contexts.append(ctx)
                page = ctx.new_page()
                page.goto(url)
                expect(page.locator("#bCrear")).to_be_visible()
                if slot == 0:
                    classic_receipt(page)
                legacy_seal = page.evaluate("compRespaldo.yo()")
                page.get_by_role("link", name="Presupuestos compartidos").click()
                expect(page.locator("#seal")).to_contain_text(legacy_seal)
                expect(page.locator("#offline")).to_contain_text("Disponible sin internet")
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), slot
            a, b, c = [ctx.pages[0] for ctx in contexts]
            seals = [page.locator("#seal").inner_text() for page in (a, b, c)]
            assert len(set(seals)) == 3
            a.locator("#create").click()
            a.locator("#title").fill("Cerámica")
            a.locator(".concept").fill("Baldosas")
            a.locator(".qty").fill("2.5")
            a.locator(".price").fill("12.50")
            expect(a.locator("#editTotal")).to_have_text("$31.25")
            save(a, 1)
            a.locator("#demo").click()
            expect(a.locator("#editTotal")).to_have_text("$650.00")
            save(a, 1)
            capture(a, "01-iphone-drywall.png")
            original = export(a)
            import_ok(b, original)
            b.get_by_role("button", name="Aceptar versión").click()
            expect(b.locator("#notice")).to_contain_text("Revisión guardada")
            approved = export(b)
            import_ok(a, approved)
            expect(current(a)).to_contain_text("Aceptado")
            print("PASS crear, editar partidas, archivo real entre sellos y aceptación exacta", flush=True)
            edit(a, 450)
            edit(b, 430)
            expect(current(a)).to_contain_text("Sin revisiones")
            b.get_by_role("button", name="Rechazar versión").click()
            expect(b.locator("#notice")).to_contain_text("Revisión guardada")
            brancha, branchb = export(a), export(b)
            import_ok(c, branchb)
            import_ok(c, brancha)
            expect(current(c)).to_have_count(2)
            expect(c.locator("#sheet h2")).to_have_text("Propuestas en conflicto")
            assert c.evaluate("document.documentElement.scrollWidth <= innerWidth")
            capture(c, "02-android-conflicto.png")
            for amount in ["$680.00", "$700.00"]:
                expect(current(c).filter(has_text=amount)).to_have_count(1)
            current(c).filter(has_text="$680.00").get_by_role("button").click()
            c.locator(".price").last.fill("440")
            save(c, 3)
            resolved = export(c)
            payload = json.loads(resolved)
            versions = [r for r in payload["records"] if r["body"]["type"] == "revision"]
            assert len(versions) == 4
            v3 = next(r for r in versions if r["body"]["version"] == 3)
            assert set(v3["body"]["parents"]) == {r["hash"] for r in versions if r["body"]["version"] == 2}
            assert all(r["body"].get("target") != v3["hash"] for r in payload["records"])
            import_ok(a, resolved)
            import_ok(a, resolved)
            expect(current(a)).to_have_count(1)
            expect(current(a)).to_contain_text("$690.00")
            print("PASS conflicto, resolución con ambos padres, reimportación idempotente", flush=True)
            payload["records"][0]["body"]["quote"]["lines"][0]["price"] += 1
            for bad in (json.dumps(payload), "texto inválido"):
                upload(a, bad)
                expect(a.locator("#notice")).to_contain_text("Archivo rechazado")
                expect(current(a)).to_contain_text("$690.00")
            after_rejection = {r["hash"]: r for r in json.loads(export(a))["records"]}
            assert after_rejection == {r["hash"]: r for r in json.loads(resolved)["records"]}
            a.locator("#history > summary").click()
            old = a.locator("#history article").filter(has_text="$650.00")
            old.get_by_role("button", name="Recuperar como nueva versión").click()
            save(a, 4)
            expect(current(a)).to_contain_text("Sin revisiones")
            print("PASS rechazo atómico y recuperación del contenido de V1 en V4", flush=True)
            # Dos pestañas del mismo origen guardan ediciones basadas en la misma V4.
            other = contexts[0].new_page()
            other.goto(url + "presupuestos/")
            doc_id = v3["body"]["id"]
            if other.locator("#documents").input_value() != doc_id:
                other.locator("#documents").select_option(doc_id)
            for page in (a, other):
                expect(current(page)).to_contain_text("$650.00")
                page.get_by_role("button", name="Proponer cambios").click()
            a.locator(".price").last.fill("410")
            other.locator(".price").last.fill("420")
            save(a, 5)
            save(other, 5)
            expect(current(other)).to_have_count(2)
            print("PASS dos pestañas conservan ambas escrituras", flush=True)
            # El servidor deja de existir. La recarga depende únicamente de la caché.
            server.shutdown()
            server.server_close()
            offline = True
            for page, ctx in [(b, contexts[1]), (c, contexts[2])]:
                page.close()
                page = ctx.new_page()
                page.goto(url + "presupuestos/")
                expect(page.locator("#seal")).to_contain_text(seals[contexts.index(ctx)])
                expect(current(page)).to_have_count(1)
                import_ok(page, resolved)
                page.get_by_role("button", name="Proponer cambios").click()
                page.locator(".price").last.fill("445")
                save(page, 4)
                page.reload()
                expect(current(page)).to_contain_text("$695.00")
                assert len(json.loads(export(page))["records"]) == 7
            print("PASS cierre, reapertura, importación, edición, recarga y exportación sin servidor", flush=True)
        finally:
            for ctx in contexts:
                ctx.close()
            for browser in browsers.values():
                browser.close()
            if not offline:
                server.shutdown()
                server.server_close()

if __name__ == "__main__":
    main()
