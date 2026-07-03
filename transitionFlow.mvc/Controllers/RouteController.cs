using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Json;
using TransitFlow.mvc.Models;
using TransitFlow.mvc.Models.DTO;
using TransitFlow.mvc.Services;

namespace TransitFlow.mvc.Controllers
{
    public class RouteController : BaseController
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ICurrentUserService _currentUserService;
        private readonly ILogger<RouteController> _logger;

        public RouteController(IHttpClientFactory httpClientFactory, ICurrentUserService currentUserService, ILogger<RouteController> logger )
        {
            _httpClientFactory = httpClientFactory;
            _currentUserService = currentUserService;
            _logger = logger;
        }

        [HttpGet("/routes")]
        public async Task<IActionResult> GetRoutes([FromQuery] int? afterId, [FromQuery] int take = 10)
        {
            var client = _httpClientFactory.CreateClient("TransitApi");
            var response = await client.GetAsync($"/routes?afterId={afterId}&take={take}");
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<PagedResponseDto<RouteModel>>();
                return Ok(result);
            }
            return await ForwardApiErrorAsync(response);
        }

        [HttpPost("/routes")]
        public async Task<IActionResult> CreateRoute([FromBody] CreateRouteDto routeData)
        {
            var client = _httpClientFactory.CreateClient("TransitApi");
            var response = await client.PostAsJsonAsync("/routes", routeData);

            if (!response.IsSuccessStatusCode)
                return await ForwardApiErrorAsync(response);

            var createdRoute = await response.Content.ReadFromJsonAsync<RouteModel>();
            if (createdRoute == null)
                return BadRequest(new ApiErrorResponseDto
                {
                    Errors = new Dictionary<string, string[]>
                    {
                        ["_general"] = new[] { "Unable to read API response." }
                    }
                });
            var user = _currentUserService.GetUser();

            if (user != null)
            {
                _logger.LogInformation("Current user: Id={UserId}, Roles={Roles}",
                    user.Id, string.Join(", ", user.Roles));
                _logger.LogInformation("Creator " + createdRoute.CreatedById);
            }
            else
            {
                _logger.LogInformation("No authenticated user found.");
            }
            var itemModel = new RouteItemViewModel
            {
                Route = createdRoute,
                User = _currentUserService.GetUser()
            };

            return PartialView("~/Views/Home/Components/RouteSidebar/Partials/_RouteItem.cshtml", itemModel);
        }

        [HttpDelete("/routes/{id}")]
        public async Task<IActionResult> DeleteRoute(int id)
        {
            var client = _httpClientFactory.CreateClient("TransitApi");
            var response = await client.DeleteAsync($"/routes/{id}");
            if (response.IsSuccessStatusCode)
                return NoContent();
            return await ForwardApiErrorAsync(response);
        }
    }
}