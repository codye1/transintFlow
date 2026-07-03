using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using TransitFlow.mvc.Controllers;
using TransitFlow.mvc.Models;
using TransitFlow.mvc.Models.DTO;
using TransitFlow.mvc.Services;

namespace TransitFlow.mvc.Controllers
{
    public class HomeController : BaseController
    {
        private readonly HttpClient _httpClient;
        private readonly ICurrentUserService _currentUserService;

        public HomeController(IHttpClientFactory httpClientFactory, ICurrentUserService currentUserService)
        {
            _httpClient = httpClientFactory.CreateClient("TransitApi");

            _currentUserService = currentUserService;
        }

        public async Task<IActionResult> Index()
        {
            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var stopsTask = _httpClient.GetAsync("stops?take=100");
            var routesTask = _httpClient.GetAsync("routes?take=100");
            var vehiclesTask = _httpClient.GetAsync("vehicles?take=100");

            await Task.WhenAll(stopsTask, routesTask, vehiclesTask);

            var stopsResponse = await stopsTask;
            var routesResponse = await routesTask;
            var vehiclesResponse = await vehiclesTask;

            List<StopModel> stops = new();
            if (stopsResponse.IsSuccessStatusCode)
            {
                var json = await stopsResponse.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<PagedResponseDto<StopModel>>(json, jsonOptions);
                stops = result?.Data ?? new();
            }

            List<RouteModel> routes = new();
            if (routesResponse.IsSuccessStatusCode)
            {
                var json = await routesResponse.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<PagedResponseDto<RouteModel>>(json, jsonOptions);
                routes = result?.Data ?? new();
            }

            List<VehicleModel> vehicles = new();
            if (vehiclesResponse.IsSuccessStatusCode)
            {
                var json = await vehiclesResponse.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<PagedResponseDto<VehicleModel>>(json, jsonOptions);
                vehicles = result?.Data ?? new();
            }

            var model = new HomeViewModel
            {
                Stops = stops,
                Routes = routes,
                Vehicles = vehicles,
                User = _currentUserService.GetUser()
            };

            return View(model); 
        }


    }
}