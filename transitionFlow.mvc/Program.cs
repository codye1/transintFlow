using TransitFlow.mvc.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();
builder.Services.AddTransient<AuthHeaderHandler>();
builder.Services.AddControllersWithViews();

builder.Services.AddHttpClient("TransitApi", client =>
{
    client.BaseAddress = new Uri("https://localhost:7094");
})
.AddHttpMessageHandler<AuthHeaderHandler>();

builder.Services.AddScoped<IComponentAssetManager, ComponentAssetManager>();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();