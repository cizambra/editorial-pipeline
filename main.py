from _compat import alias_module

module = alias_module(__name__, "app.main")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=module._settings.host,
        port=module._settings.port,
        reload=module._settings.reload,
    )
