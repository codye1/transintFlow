using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Json;
using TransitFlow.mvc.Models.DTO;
using TransitFlow.mvc.Services;

namespace TransitFlow.mvc.Controllers
{
    public class AuthController : BaseController
    {
        private readonly IHttpClientFactory _httpClientFactory;

        public AuthController(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;

        }

        [HttpGet("/login")]
        public IActionResult Login()
        {
            return View("~/Views/Auth/Auth.cshtml");
        }

        [HttpPost("/auth/login")]
        public async Task<IActionResult> ProxyLogin([FromBody] AuthLoginRequestDto model)
        {
            var client = _httpClientFactory.CreateClient();
            var response = await client.PostAsJsonAsync("https://localhost:7094/auth/login", model);

            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<AuthResponseDto>();
                if (result != null)
                {
                    Response.Cookies.Append("accessToken", result.AccessToken, new CookieOptions
                    {
                        HttpOnly = true,
                        Secure = true,
                        SameSite = SameSiteMode.Strict
                    });

                    if (response.Headers.TryGetValues("Set-Cookie", out var cookieHeaders))
                    {
                        foreach (var cookie in cookieHeaders)
                        {
                            Response.Headers.Append("Set-Cookie", cookie);
                        }
                    }

                    return Ok();
                }
            }

            return await ForwardApiErrorAsync(response);
        }

        [HttpPost("/auth/register")]
        public async Task<IActionResult> ProxyRegister([FromBody] AuthRegisterRequestDto model)
        {
            var client = _httpClientFactory.CreateClient();
            var response = await client.PostAsJsonAsync("https://localhost:7094/auth/register", model);

            if (response.IsSuccessStatusCode)
            {
                return Ok();
            }

            return await ForwardApiErrorAsync(response);
        }

        [HttpPost("/auth/logout")]
        [ValidateAntiForgeryToken]

        public IActionResult Logout()
        {
            Response.Cookies.Delete("accessToken");
            Response.Cookies.Delete("refreshToken");
            return RedirectToAction("Index", "Home");
        }
    }
}