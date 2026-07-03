using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Json;
using TransitFlow.mvc.Models;
using TransitFlow.mvc.Models.DTO;
using TransitFlow.mvc.Services;

namespace TransitFlow.mvc.Controllers
{
    public class StopsController : BaseController
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ICurrentUserService _currentUserService;

        public StopsController(IHttpClientFactory httpClientFactory, ICurrentUserService currentUserService)
        {
            _httpClientFactory = httpClientFactory;
            _currentUserService = currentUserService;
        }

        [HttpPost("/stops")]
        public async Task<IActionResult> CreateStop([FromBody] StopCreateDto stopData)
        {
            var client = _httpClientFactory.CreateClient("TransitApi");
            var response = await client.PostAsJsonAsync("/stops", stopData);

            if (response.IsSuccessStatusCode)
            {
                var createdStop = await response.Content.ReadFromJsonAsync<StopModel>();
                if (createdStop == null)
                    return BadRequest(new ApiErrorResponseDto
                    {
                        Errors = new Dictionary<string, string[]>
                        {
                            ["_general"] = new[] { "Unable to read API response." }
                        }
                    });

                var itemModel = new StopItemViewModel
                {
                    Stop = createdStop,
                    User = _currentUserService.GetUser()
                };

                return PartialView("~/Views/Home/Components/StopSidebar/Partials/_StopItem.cshtml", itemModel);
            }

            return await ForwardApiErrorAsync(response);
        }

        [HttpDelete("/stops/{id}")]
        public async Task<IActionResult> DeleteStop(int id)
        {
            var client = _httpClientFactory.CreateClient("TransitApi");
            var response = await client.DeleteAsync($"/stops/{id}");

            if (response.IsSuccessStatusCode)
                return NoContent();

            return await ForwardApiErrorAsync(response);
        }

        [HttpPut("/stops/{id}")]
        public async Task<IActionResult> UpdateStop(int id, [FromBody] StopUpdateDto stopData)
        {
            var client = _httpClientFactory.CreateClient("TransitApi");

            // Відправляємо PUT запит на Web API
            var response = await client.PutAsJsonAsync($"/stops/{id}", stopData);

            if (response.IsSuccessStatusCode)
                return NoContent();

            return await ForwardApiErrorAsync(response);
        }
    }


}